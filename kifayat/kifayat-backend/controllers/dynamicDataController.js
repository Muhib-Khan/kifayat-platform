const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");
const { proxyRequest, proxyRequestSimple, resolveHhcToken } = require("./hhcApiController");
const groqKeyPool = require("../utils/groqKeyPool");

// ── Grand Sync state (persists across page switches) ─────────────────────────
const dynamicSyncState = {
  requestId: null,
  running: false,
  aborted: false,
  logs: [],
  phase: null,
  catalogTotal: 0,
  catalogPages: 0,
  catalogItems: 0,
  slugUpdates: 0,
  staleCleaned: 0,
  total: 0,
  processed: 0,
  ok: 0,
  withVideos: 0,
  withVariations: 0,
  notFound: 0,
  unprocessable: 0,
  perProduct403: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  summary: null,
};

function resetDynamicSyncState() {
  Object.assign(dynamicSyncState, {
    requestId: null,
    running: false,
    aborted: false,
    logs: [],
    phase: null,
    catalogTotal: 0,
    catalogPages: 0,
    catalogItems: 0,
    slugUpdates: 0,
    staleCleaned: 0,
    total: 0,
    processed: 0,
    ok: 0,
    withVideos: 0,
    withVariations: 0,
    notFound: 0,
    unprocessable: 0,
    perProduct403: 0,
    failed: 0,
    startedAt: null,
    finishedAt: null,
    summary: null,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGINATE = 40;
const LIST_CONCURRENCY = 10;
const SLUG_CONCURRENCY = 40;
const CATALOG_URL = (page) =>
  `/dropshipper/products?page=${page}&paginate=${PAGINATE}&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=`;

// ── Extract ordered gallery media from the HHC dynamic API response ─────────
// Returns [{ id, url, type: "image" | "video" }]. The thumbnail is always
// first (storefront convention), followed by every image/video in
// product_galleries. The HHC media ids are kept so a selected variation can
// map to its own image via variationImgID.
function extractGallery(data) {
  const gallery = [];

  const thumbnail = data?.product_thumbnail;
  if (thumbnail) {
    const t =
      typeof thumbnail === "string"
        ? thumbnail
        : thumbnail?.original_url || thumbnail?.url || thumbnail?.path || "";
    const clean = String(t).split("?")[0].trim();
    if (clean) gallery.push({ id: null, url: clean, type: "image" });
  }

  const galleries = Array.isArray(data?.product_galleries)
    ? data.product_galleries
    : Array.isArray(data?.product_gallery)
      ? data.product_gallery
      : [];
  for (const g of galleries) {
    const raw =
      typeof g === "string" ? g : g?.original_url || g?.url || g?.path || "";
    const clean = String(raw).split("?")[0].trim();
    if (!clean) continue;
    // Videos first, then images; anything else (docs, audio, …) is skipped
    const type = /\.(mp4|mov|webm|m4v|avi)$/i.test(clean)
      ? "video"
      : /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(clean)
        ? "image"
        : null;
    if (!type) continue;
    gallery.push({
      id: g && typeof g === "object" && g.id != null ? g.id : null,
      url: clean,
      type,
    });
  }

  return gallery.filter(
    (item, i, arr) => arr.findIndex((x) => x.url === item.url) === i
  );
}

// Legacy helper kept for tests: just the image URLs (thumbnail first).
function extractImages(data) {
  return extractGallery(data)
    .filter((item) => item.type === "image")
    .map((item) => item.url);
}

// ── Fetch dynamic data for a single product by slug and persist it ──────────
// Reads the product's existing slug field, fetches
// https://member.hhcdropshipping.com/api/dropshipper/product/slug/<slug>
// and upserts the response into the DynamicData collection — existing records
// are updated by slug so no duplicates are ever created. The product itself is
// updated with its multiple images (comma-joined imageUrl, existing
// storefront convention) and its variations so the storefront data is
// enriched too. imageUrl is only overwritten when the API returned images so
// a valid existing image is never wiped out.
async function fetchAndSaveDynamicData(product, token) {
  const slug = (product.slug || "").trim();

  const endpoint = `/dropshipper/product/slug/${encodeURIComponent(slug)}`;
  const result = await proxyRequest(endpoint, token, null, 1);

  if (result.status !== 200) {
    const err = new Error(
      `HHC API responded with status ${result.status}. ${
        typeof result.data === "string"
          ? result.data.slice(0, 200)
          : JSON.stringify(result.data ?? {}).slice(0, 200)
      }`
    );
    err.hhcStatus = result.status;
    err.hhcData = result.data;
    throw err;
  }

  const data = result.data && typeof result.data === "object" ? result.data : {};
  const gallery = extractGallery(data);
  const images = gallery.filter((item) => item.type === "image").map((item) => item.url);
  const videos = gallery.filter((item) => item.type === "video").map((item) => item.url);
  const variations = Array.isArray(data.variations) ? data.variations : [];

  const productUpdate = {};
  if (images.length > 0) productUpdate.imageUrl = images.join(",");
  productUpdate.variations = variations;
  productUpdate.gallery = gallery;
  // HHC variation quantities are the live availability: keep product.stock in
  // sync (cart validation, admin views, CSV exports all read stock).
  if (variations.length > 0) {
    productUpdate.stock = variations.reduce((sum, v) => sum + (Number(v?.quantity) || 0), 0);
  }
  await Product.updateOne({ _id: product._id }, { $set: productUpdate });

  const payload = {
    slug,
    product: product._id,
    productId: product.productId || "",
    name: product.name || "",
    images,
    videos,
    variations,
    gallery,
    fetchedAt: new Date(),
  };

  const existing = await DynamicData.findOne({ slug });
  let dynamicData;
  if (existing) {
    await DynamicData.updateOne({ _id: existing._id }, { $set: payload });
    dynamicData = await DynamicData.findById(existing._id).lean();
  } else {
    dynamicData = await DynamicData.create(payload);
  }

  return { images, videos, variations, gallery, dynamicData };
}

// ── Route handler (Admin → Products, "Get Product Dynamic Data") ────────────
const fetchProductDynamicData = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).lean();
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const slug = (product.slug || "").trim();
    if (!slug) {
      return res.status(400).json({
        success: false,
        message:
          'This product has no slug. Run "Sync All Products" on the HHC Sync page or update the product first.',
      });
    }

    const token = await resolveHhcToken(req.body?.token);
    if (!token) {
      return res.status(400).json({
        success: false,
        message:
          "No HHC bearer token saved. Save it once on the HHC Sync page first.",
      });
    }

    const { images, videos, variations, dynamicData } = await fetchAndSaveDynamicData(
      product,
      token
    );

    return res.status(200).json({
      success: true,
      message: `Dynamic data fetched and saved — ${images.length} image(s), ${videos.length} video(s), ${variations.length} variation(s).`,
      dynamicData,
      images,
      videos,
      variations,
    });
  } catch (err) {
    if (err.hhcStatus) {
      return res.status(err.hhcStatus >= 500 ? 502 : 400).json({
        success: false,
        message: err.message,
        status: err.hhcStatus,
      });
    }
    console.error("HHC single product dynamic data error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dynamic data.",
      error: err.message,
    });
  }
};

// ── Grand Sync: Phase 1 — sweep the full HHC catalog ────────────────────────
// Fetches every catalog page (list endpoint, which carries detail.slug — the
// product's REAL slug on HHC) and bulk-updates our DB products' slugs/names by
// productId. Stale DynamicData rows for renamed products are deleted so Phase 2
// re-fetches them under the correct slug.
async function sweepCatalog(token, emit) {
  dynamicSyncState.phase = "catalog";
  emit("grand_started", "Phase 1 — scanning the full HHC catalog…");

  const first = await proxyRequest(CATALOG_URL(1), token, null, 1);
  if (first.status !== 200) throw new Error(`catalog page 1 -> ${first.status}`);
  const total = Number(first.data?.total || first.data?.recordsTotal || 0);
  const pages = Math.max(1, Math.ceil(total / PAGINATE));
  dynamicSyncState.catalogTotal = total;
  dynamicSyncState.catalogPages = pages;
  emit("catalog", `Catalog: ${total} products = ${pages} pages.`, {
    total,
    pages,
  });

  const extract = (data) =>
    Array.isArray(data) ? data : data?.data || data?.products || data?.items || [];

  const items = [];
  let next = 2;
  let fetched = 1;

  async function worker() {
    while (next <= pages) {
      if (dynamicSyncState.aborted) return;
      const page = next++;
      try {
        const r = await proxyRequest(CATALOG_URL(page), token, null, page);
        if (r.status === 200) {
          items.push(...extract(r.data));
          fetched++;
        } else if (r.status === 403 || r.status === 429) {
          await sleep(10000);
        }
      } catch (err) {
        // keep going
      }
      if (fetched % 50 === 0 || page === pages) {
        dynamicSyncState.catalogItems = items.length;
        emit("catalog", `Pages fetched: ${fetched}/${pages} (${items.length} items).`, {
          pagesFetched: fetched,
          pages,
          items: items.length,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: LIST_CONCURRENCY }, () => worker()));
  items.push(...extract(first.data));
  dynamicSyncState.catalogItems = items.length;
  emit("catalog", `Fetched ${items.length} catalog items — syncing slugs & names…`);

  const byId = new Map();
  for (const it of items) {
    const slug = String(it.detail?.slug || "").trim();
    if (it.id == null || !slug) continue;
    byId.set(String(it.id), { slug, name: String(it.name || "").trim() });
  }

  const dbProducts = await Product.find({}).select("productId slug name").lean();
  const bulkOps = [];
  const changedIds = [];
  for (const p of dbProducts) {
    const pid = String(p.productId || "");
    if (!pid) continue;
    const hit = byId.get(pid);
    if (!hit) continue;
    if (hit.slug !== p.slug || (hit.name && hit.name !== p.name)) {
      bulkOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { slug: hit.slug, name: hit.name || p.name } },
        },
      });
      if (hit.slug !== p.slug) changedIds.push(p._id);
    }
  }
  dynamicSyncState.slugUpdates = bulkOps.length;

  let staleCleaned = 0;
  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false });
    if (changedIds.length > 0) {
      const del = await DynamicData.deleteMany({ product: { $in: changedIds } });
      staleCleaned = del.deletedCount || 0;
    }
  }
  dynamicSyncState.staleCleaned = staleCleaned;
  emit("catalog", `${bulkOps.length} slug/name updates (${changedIds.length} slug changes, ${staleCleaned} stale dynamic records removed).`, {
    slugUpdates: bulkOps.length,
    slugChanges: changedIds.length,
    staleCleaned,
  });
  return byId;
}

// ── Grand Sync: Phase 2 — bulk-fetch dynamic data for ALL products ───────────
async function fetchAllDynamic(token, byId, emit) {
  dynamicSyncState.phase = "fetch";
  const dbProducts = await Product.find({}).select("productId slug name").lean();
  const todo = [];
  let notInCatalog = 0;
  for (const p of dbProducts) {
    const pid = String(p.productId || "");
    if (!pid || !byId.has(pid)) {
      notInCatalog++;
      continue;
    }
    todo.push({
      _id: p._id,
      productId: pid,
      name: p.name || "",
      slug: byId.get(pid).slug,
    });
  }
  dynamicSyncState.total = todo.length;
  emit(
    "grand_started",
    `Phase 2 — fetching pictures, videos & variations for ${todo.length} products (${notInCatalog} not on HHC).`,
    { total: todo.length, notInCatalog }
  );

  let ok = 0;
  let withVideos = 0;
  let withVariations = 0;
  let notFound = 0;
  let unprocessable = 0;
  let perProduct403 = 0;
  let failed = 0;
  let next = 0;
  let backoff = 0;

  async function worker() {
    while (next < todo.length) {
      if (dynamicSyncState.aborted) return;
      const p = todo[next++];
      if (backoff > 0) await sleep(backoff);
      if (dynamicSyncState.aborted) return;
      try {
        const { videos, variations } = await fetchAndSaveDynamicData(p, token);
        ok++;
        if (videos.length > 0) withVideos++;
        if (variations.length > 0) withVariations++;
        if (backoff > 0) backoff = 0;
      } catch (err) {
        const status = err.hhcStatus;
        const msg = String(err.message || "");
        if (status === 404) {
          notFound++;
        } else if (
          status === 429 ||
          (status === 403 && /unauthorized|token|expired|invalid/i.test(msg))
        ) {
          backoff = backoff ? Math.min(backoff * 2, 60000) : 10000;
          emit("waiting", `${status} rate-limited — backing off ${backoff}ms.`, { backoff });
        } else if (status === 403) {
          perProduct403++;
        } else if (status === 422) {
          unprocessable++;
        } else {
          failed++;
        }
      }
      dynamicSyncState.processed = next;
      dynamicSyncState.ok = ok;
      dynamicSyncState.withVideos = withVideos;
      dynamicSyncState.withVariations = withVariations;
      dynamicSyncState.notFound = notFound;
      dynamicSyncState.unprocessable = unprocessable;
      dynamicSyncState.perProduct403 = perProduct403;
      dynamicSyncState.failed = failed;
      if (next % 100 === 0 || next === todo.length) {
        emit(
          "progress",
          `Processed ${next}/${todo.length} — ok:${ok} videos:${withVideos} variations:${withVariations} | 404:${notFound} 422:${unprocessable} 403:${perProduct403} errors:${failed}`,
          {
            processed: next,
            total: todo.length,
            ok,
            withVideos,
            withVariations,
            notFound,
            unprocessable,
            perProduct403,
            failed,
          }
        );
      }
    }
  }

  await Promise.all(Array.from({ length: SLUG_CONCURRENCY }, () => worker()));

  if (dynamicSyncState.aborted) {
    emit("stopped", `Grand sync stopped — ${ok} products fetched before stop.`, {
      ok,
      processed: next,
    });
    return;
  }
  emit(
    "done",
    `Phase 2 done — ${ok} fetched (${withVideos} with videos, ${withVariations} with variations) | 404:${notFound} 422:${unprocessable} 403:${perProduct403} errors:${failed}`,
    { processed: next, total: todo.length, ok, withVideos, withVariations, notFound, unprocessable, perProduct403, failed }
  );
}

// ── Grand Sync route handler ─────────────────────────────────────────────────
// POST /api/hhc-proxy/sync-dynamic-all  (admin only)
// Responds immediately, then runs in the background streaming
// dynamic_all_progress socket events. Fetches pictures, videos and variations
// for EVERY product on HHC (fresh data every run).
const syncDynamicAll = async (req, res) => {
  try {
    if (dynamicSyncState.running) {
      return res.status(409).json({
        success: false,
        message: "A Grand Sync is already in progress. Stop it first or wait for it to finish.",
      });
    }

    const token = await resolveHhcToken(req.body?.token);
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No HHC bearer token saved. Save it once on the HHC Sync page first.",
      });
    }

    // ── Verify the token against HHC BEFORE starting the background job ──────
    // A non-empty token is not enough: it may be expired, revoked or invalid.
    // Reuse the same lightweight probe as testToken so Grand Sync fails fast
    // with a clear message instead of silently 403-ing through the whole run.
    try {
      const probe = await proxyRequestSimple(
        "/dropshipper/products?page=1&paginate=1",
        token,
      );
      if (probe.status !== 200) {
        return res.status(401).json({
          success: false,
          message: `HHC rejected the bearer token (HTTP ${probe.status}). ${
            probe.status === 401 || probe.status === 403
              ? "The token is invalid or expired — paste a fresh one and click 'Test token' first."
              : "The token could not be verified right now — check the HHC API and try again."
          }`,
          status: probe.status,
        });
      }
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `Could not reach the HHC API to verify the token: ${err.message}`,
      });
    }

    resetDynamicSyncState();
    dynamicSyncState.running = true;
    dynamicSyncState.requestId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    dynamicSyncState.startedAt = new Date();

    const io = req.app.get("io");
    const emit = (type, message, extra = {}) => {
      const entry = { type, message, time: new Date().toLocaleTimeString(), ...extra };
      dynamicSyncState.logs.push(entry);
      if (dynamicSyncState.logs.length > 500) dynamicSyncState.logs.shift();
      if (io) io.emit("dynamic_all_progress", { requestId: dynamicSyncState.requestId, ...entry });
      return entry;
    };

    res.json({
      success: true,
      message: "Grand Sync started — fetching pictures, videos & variations for all products in the background.",
    });

    (async () => {
      try {
        const byId = await sweepCatalog(token, emit);
        await fetchAllDynamic(token, byId, emit);

        // ── Phase 3: AI re-categorization + SEO optimization ─────────────
        let seoUpdated = 0;
        let seoUnchanged = 0;
        if (!dynamicSyncState.aborted) {
          dynamicSyncState.phase = "seo";
          emit("seo_started", "Phase 3 — AI re-categorization & SEO optimization of all products…");

          if (!(await groqKeyPool.hasKeys())) {
            emit("seo_skipped", "No Groq API keys configured — skipping re-categorization & SEO. Add keys in Admin → Settings.");
          } else {
            // Wait for a standalone Re-categorize job to finish first
            const { recategorizeState, runRecategorizeAndOptimize } = require("./productController");
            while (recategorizeState.running) {
              if (dynamicSyncState.aborted) break;
              emit("waiting", "Waiting for the running Re-categorize job to finish…");
              await sleep(10000);
            }

            if (!dynamicSyncState.aborted) {
              try {
                const seoResult = await runRecategorizeAndOptimize({
                  addLog: emit,
                  io,
                  isAborted: () => dynamicSyncState.aborted,
                });
                seoUpdated = seoResult.updated;
                seoUnchanged = seoResult.unchanged;
                emit(
                  "seo_done",
                  `SEO & categorization complete — ${seoResult.updated} products improved, ${seoResult.unchanged} already optimized.`,
                  { updated: seoResult.updated, unchanged: seoResult.unchanged, total: seoResult.total }
                );
              } catch (err) {
                emit("error", `Re-categorization & SEO failed: ${err.message}`, { error: err.message });
              }
            }
          }
        }

        if (!dynamicSyncState.aborted) {
          emit(
            "grand_done",
            `Grand Sync complete — ${dynamicSyncState.ok} products enriched (${dynamicSyncState.withVideos} with videos, ${dynamicSyncState.withVariations} with variations), ${seoUpdated} categorized/SEO-optimized. 404:${dynamicSyncState.notFound} errors:${dynamicSyncState.failed}`,
            {
              summary: {
                ok: dynamicSyncState.ok,
                withVideos: dynamicSyncState.withVideos,
                withVariations: dynamicSyncState.withVariations,
                notFound: dynamicSyncState.notFound,
                unprocessable: dynamicSyncState.unprocessable,
                perProduct403: dynamicSyncState.perProduct403,
                failed: dynamicSyncState.failed,
                slugUpdates: dynamicSyncState.slugUpdates,
                staleCleaned: dynamicSyncState.staleCleaned,
                seoUpdated,
                seoUnchanged,
              },
            }
          );
          if (io) {
            io.emit("products_updated", {
              source: "hhc-dynamic",
              fetched: dynamicSyncState.ok,
            });
          }
        }
      } catch (err) {
        emit("error", `Grand Sync failed: ${err.message}`, { error: err.message });
      } finally {
        dynamicSyncState.running = false;
        dynamicSyncState.finishedAt = new Date();
      }
    })();
  } catch (err) {
    console.error("HHC grand sync error:", err);
    dynamicSyncState.running = false;
    return res.status(500).json({
      success: false,
      message: "Failed to start Grand Sync.",
      error: err.message,
    });
  }
};

const getDynamicSyncStatus = (req, res) => {
  return res.status(200).json({ success: true, ...dynamicSyncState });
};

const stopDynamicSync = (req, res) => {
  dynamicSyncState.aborted = true;
  const entry = {
    type: "stopped",
    message: "Stopping Grand Sync — the current batch finishes, then it stops.",
    time: new Date().toLocaleTimeString(),
  };
  dynamicSyncState.logs.push(entry);
  const io = req.app.get("io");
  if (io) {
    io.emit("dynamic_all_progress", { requestId: dynamicSyncState.requestId, ...entry });
  }
  return res.status(200).json({ success: true, message: "Grand Sync stopping." });
};

module.exports = {
  fetchProductDynamicData,
  fetchAndSaveDynamicData,
  extractImages,
  extractGallery,
  syncDynamicAll,
  getDynamicSyncStatus,
  stopDynamicSync,
  dynamicSyncState,
};
