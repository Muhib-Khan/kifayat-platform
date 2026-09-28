const https = require("https");
const zlib = require("zlib");
const Product = require("../models/Product");
const Settings = require("../models/Settings");
const {
  deleteAllOutOfStock,
  notifyStockAlertCustomers,
} = require("../utils/outOfStockManager");
const { CATEGORIES, categorizeProduct } = require("../utils/categorize");
const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
const { loadPricingRules, priceProductFromRules } = require("../utils/pricing");
const { generateKeywords } = require("../utils/seoKeywords");

const agent = new https.Agent({ keepAlive: true, timeout: 30000, maxSockets: 5 });

// ── Sync State (persists across tab switches) ───────────────────────────────
const syncState = {
  requestId: null,
  running: false,
  logs: [],
  summary: null,
  batchStartTime: null,
  aborted: false,
  createdProductIds: [],
};

function resetSyncState() {
  syncState.requestId = null;
  syncState.running = false;
  syncState.logs = [];
  syncState.summary = null;
  syncState.batchStartTime = null;
  syncState.aborted = false;
  syncState.createdProductIds = [];
}

function addLog(type, message, extra = {}) {
  const entry = { type, message, time: new Date().toLocaleTimeString(), ...extra };
  syncState.logs.push(entry);
  return entry;
}

// ── Rotating User-Agent pool ────────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
];

const SEC_CH_UA_VARIANTS = [
  '"Not/A)Brand";v="99", "Google Chrome";v="125", "Chromium";v="125"',
  '"Not/A)Brand";v="99", "Google Chrome";v="126", "Chromium";v="126"',
  '"Not/A)Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
  '"Not/A)Brand";v="99", "Google Chrome";v="124", "Chromium";v="124"',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildHeaders(token) {
  return {
    "User-Agent": pickRandom(USER_AGENTS),
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,ur;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua": pickRandom(SEC_CH_UA_VARIANTS),
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": Math.random() > 0.2 ? '"Windows"' : '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "X-Requested-With": "XMLHttpRequest",
    Authorization: `Bearer ${token}`,
    Referer: process.env.HHC_REFERER || "https://member.hhcdropshipping.com/",
    Origin: process.env.HHC_ORIGIN || "https://member.hhcdropshipping.com",
  };
}

// ── 5–7 second random delay ─────────────────────────────────────────────────
function randomDelay() {
  const ms = Math.floor(Math.random() * 2001) + 5000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Stored bearer token (shared by pagination + dynamic sync) ───────────────
async function getStoredHhcToken() {
  try {
    const settings = await Settings.findOne({});
    return settings?.hhcToken || "";
  } catch {
    return "";
  }
}

async function saveStoredHhcToken(token) {
  try {
    const settings = await Settings.findOne({});
    if (settings) {
      if (settings.hhcToken !== token) {
        settings.hhcToken = token;
        await settings.save();
      }
    } else {
      await Settings.create({ hhcToken: token });
    }
    return true;
  } catch {
    return false;
  }
}

// Use the provided token (persisting it for reuse) or fall back to the
// server-stored token so the admin only enters it once for both syncs.
async function resolveHhcToken(bodyToken) {
  if (typeof bodyToken === "string" && bodyToken.trim()) {
    const t = bodyToken.trim();
    await saveStoredHhcToken(t);
    return t;
  }
  return getStoredHhcToken();
}

// ── Proxy request with retry & backoff ──────────────────────────────────────
async function proxyRequest(endpoint, token, emit, page) {
  const base =
    process.env.HHC_API_URL || "https://member.hhcdropshipping.com/api";
  const url = new URL(`${base}${endpoint}`);

  const MAX_RETRIES = 3;
  const MAX_REDIRECTS = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      // Follow redirects (e.g. HHC sometimes 308s the product/slug endpoint)
      let currentUrl = url;
      let redirects = 0;

      for (;;) {
        const headers = buildHeaders(token);
        const options = {
          hostname: currentUrl.hostname,
          port: currentUrl.port || 443,
          path: currentUrl.pathname + currentUrl.search,
          method: "GET",
          headers,
          agent,
        };

        const result = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              const buffer = Buffer.concat(chunks);
              const encoding = res.headers["content-encoding"] || "";

              let raw;
              if (encoding.includes("gzip")) {
                raw = zlib.gunzipSync(buffer).toString("utf-8");
              } else if (encoding.includes("deflate")) {
                raw = zlib.inflateSync(buffer).toString("utf-8");
              } else if (encoding.includes("br")) {
                try {
                  raw = zlib.brotliDecompressSync(buffer).toString("utf-8");
                } catch {
                  raw = buffer.toString("utf-8");
                }
              } else {
                raw = buffer.toString("utf-8");
              }

              let data;
              try {
                data = JSON.parse(raw);
              } catch {
                data = raw;
              }
              resolve({
                status: res.statusCode,
                data,
                url: endpoint,
                location: res.headers.location || null,
              });
            });
          });

          req.on("error", (err) => reject(err));
          req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error("Request timed out"));
          });
          req.end();
        });

        if (
          result.status >= 300 &&
          result.status < 400 &&
          result.location &&
          redirects < MAX_REDIRECTS
        ) {
          currentUrl = new URL(result.location, currentUrl);
          redirects++;
          continue;
        }

        return result;
      }
    } catch (err) {
      lastError = err;
      if (attempt <= MAX_RETRIES) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.floor(Math.random() * 2000);
        if (emit) {
          const entry = emit("retry", `Retry ${attempt}/${MAX_RETRIES} for page ${page} in ${(backoff / 1000).toFixed(1)}s: ${err.message}`, { page, attempt, maxRetries: MAX_RETRIES, delayMs: backoff });
        }
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastError || new Error("Request failed after retries");
}

// ── Simple single-shot request (no rate limit, no retry) for quick ops ──────
async function proxyRequestSimple(endpoint, token) {
  const base =
    process.env.HHC_API_URL || "https://member.hhcdropshipping.com/api";
  const url = new URL(`${base}${endpoint}`);
  const headers = buildHeaders(token);

  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: "GET",
    headers,
    agent,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const encoding = res.headers["content-encoding"] || "";

        let raw;
        if (encoding.includes("gzip")) {
          raw = zlib.gunzipSync(buffer).toString("utf-8");
        } else if (encoding.includes("deflate")) {
          raw = zlib.inflateSync(buffer).toString("utf-8");
        } else if (encoding.includes("br")) {
          try {
            raw = zlib.brotliDecompressSync(buffer).toString("utf-8");
          } catch {
            raw = buffer.toString("utf-8");
          }
        } else {
          raw = buffer.toString("utf-8");
        }

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        resolve({ status: res.statusCode, data, url: endpoint });
      });
    });

    req.on("error", (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

function slugify(name) {
  if (!name) return "";
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200) || "product";
}

function extractProducts(responseData) {
  if (Array.isArray(responseData)) return responseData;
  if (responseData?.data && Array.isArray(responseData.data))
    return responseData.data;
  if (responseData?.products && Array.isArray(responseData.products))
    return responseData.products;
  if (responseData?.result && Array.isArray(responseData.result))
    return responseData.result;
  if (responseData?.items && Array.isArray(responseData.items))
    return responseData.items;
  return null;
}

function extractVideoUrl(item) {
  if (typeof item.video === "string" && item.video) return item.video.trim();
  if (typeof item.video_url === "string" && item.video_url) return item.video_url.trim();
  if (typeof item.VideoUrl === "string" && item.VideoUrl) return item.VideoUrl.trim();
  if (typeof item.video_link === "string" && item.video_link) return item.video_link.trim();
  const lowerKeys = Object.keys(item).reduce((acc, k) => ({ ...acc, [k.toLowerCase()]: k }), {});
  for (const keyword of ["video_url", "videourl", "video_link", "videos", "video"]) {
    const origKey = lowerKeys[keyword];
    if (origKey && typeof item[origKey] === "string" && item[origKey]) {
      return item[origKey].trim();
    }
  }
  return "";
}

function extractImageUrl(item) {
  // Check nested product_thumbnail.original_url
  if (item.product_thumbnail && typeof item.product_thumbnail === "object") {
    const url = item.product_thumbnail.original_url || item.product_thumbnail.url || item.product_thumbnail.source || "";
    if (url) return String(url).trim();
  }
  // Check product_thumbnail as direct string
  if (item.product_thumbnail && typeof item.product_thumbnail === "string") {
    return item.product_thumbnail.trim();
  }

  const pick = (...keys) => {
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== "")
        return item[key];
      const lower = key.toLowerCase();
      for (const k of Object.keys(item)) {
        if (k.toLowerCase() === lower) {
          const v = item[k];
          if (typeof v === "string") return v;
          if (typeof v === "object" && v !== null) {
            return v.original_url || v.url || v.source || JSON.stringify(v);
          }
          return v;
        }
      }
    }
    return "";
  };

  return pick(
    "image", "Image", "image_url", "ImageUrl", "images", "Images",
    "img", "photo", "thumbnail", "image_link",
  );
}

function mapHHCProduct(item) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== "")
        return item[key];
      const lower = key.toLowerCase();
      for (const k of Object.keys(item)) {
        if (k.toLowerCase() === lower) return item[k];
      }
    }
    return "";
  };

  const rawName =
    pick("name", "Name", "product_name", "ProductName", "title", "Title") || "";
  const rawSku =
    pick("sku", "SKU", "sku_code", "SkuCode", "code", "article_no") || "";
  const rawPrice =
    Number(
      pick(
        "price", "Price", "retail_price", "RetailPrice",
        "wholesale_price", "WholesalePrice", "selling_price", "SellingPrice",
        "mrp", "MRP",
      ),
    ) || 0;
  const rawStockValue = Number(
    pick(
      "stock", "Stock", "quantity", "Quantity", "qty", "Qty",
      "in_stock", "InStock",
    ),
  );
  // HHC sends quantity:null for variable-type products while stockStatus still
  // says "In stock" — fall back to stockStatus when no quantity is provided so
  // in-stock products are never treated as 0 stock. Use STOCK_THRESHOLD as the
  // placeholder so order workflow (stock < 15) doesn't flag them as insufficient.
  const rawStock =
    rawStockValue > 0
      ? rawStockValue
      : (
          Number(pick("stockStatus", "StockStatus")) === 1 ||
          String(pick("stock_status_name", "StockStatusName")).toLowerCase() === "in stock"
        )
        ? 15
        : 0;
  // NOTE: HHC's `type` field is the product KIND ("simple" / "variable"), not a
  // category. Including it here made every product import as category "simple",
  // which matched no storefront category, so no products ever appeared on a
  // category page. Only real category fields are picked; otherwise the product
  // is classified from its name + description below.
  const rawCategory =
    pick(
      "category", "Category", "categories", "Categories",
    ) || "Uncategorized";
  const rawImage = extractImageUrl(item);
  const rawVideo = extractVideoUrl(item);
  const rawDescription =
    pick(
      "description", "Description", "desc", "Desc", "details", "Details",
      "short_description", "ShortDescription",
    ) || "";
  const rawWeight =
    Number(pick("weight", "Weight", "weight_kg", "WeightKg", "wt", "Wt")) || 0;
  const rawProductId =
    pick(
      "id", "ID", "Id", "_id", "product_id", "ProductId", "pid", "PID", "productId",
    ) || "";

  const name = String(rawName).trim();
  // HHC category/type fields are unreliable (often the product's `type`, i.e.
  // "simple"/"variable", or a raw array) — extract a first element if it's an
  // array, then classify by name + description unless we got a real category name.
  let category = "";
  if (Array.isArray(rawCategory)) {
    category = String(rawCategory[0] ?? "").split(",")[0].split(">")[0].trim();
  } else if (typeof rawCategory === "string") {
    category = rawCategory.split(",")[0].split(">")[0].trim();
  }
  const canonical = new Set(CATEGORY_NAMES);
  if (!category || category === "Uncategorized" || !canonical.has(category)) {
    category = categorizeProduct(name, String(rawDescription).trim());
  }

  return {
    productId: String(rawProductId).trim(),
    sku: String(rawSku).trim(),
    name,
    slug: slugify(name),
    description: String(rawDescription).trim(),
    wholesalePrice: rawPrice,
    retailPrice: rawPrice,
    stock: rawStock,
    originalStock: rawStock,
    category: category || "Uncategorized",
    imageUrl: String(rawImage).split(",")[0].split("?")[0].trim(),
    videoUrl: rawVideo ? String(rawVideo).split(",")[0].split("?")[0].trim() : "",
    weight: rawWeight,
    salesCount: 0,
    uploadBatch: `hhc-import-${new Date().toISOString()}`,
    newProduct: true,
  };
}

// ── Save products to DB (bulk upsert by sku or productId) ────────────
async function saveProductsToDB(products, io, emit, page = null) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const mappedProducts = products
    .map((item) => mapHHCProduct(item))
    .filter((product) => product.name);

  if (mappedProducts.length === 0) return { created: 0, updated: 0, skipped: 0 };

  if (page !== null) {
    for (const p of mappedProducts) p.page = page;
  }

  // Fetch all existing products in this batch by SKU or productId
  const skus = mappedProducts.filter(p => p.sku).map(p => p.sku);
  const pids = mappedProducts.filter(p => !p.sku && p.productId).map(p => p.productId);
  const matchConditions = [];
  if (skus.length) matchConditions.push({ sku: { $in: skus } });
  if (pids.length) matchConditions.push({ productId: { $in: pids } });

  const existingMap = {};
  if (matchConditions.length > 0) {
    const existingDocs = await Product.find({ $or: matchConditions }).select("_id sku productId salesCount keywords");
    for (const doc of existingDocs) {
      if (doc.sku) existingMap["sku:" + doc.sku] = doc;
      if (doc.productId) existingMap["pid:" + doc.productId] = doc;
    }
  }

  const updateOps = [];
  const insertDocs = [];

  for (const p of mappedProducts) {
    // Auto-generate deterministic SEO keywords from name + category.
    // For existing products: only fill if they have no keywords yet (preserve
    // admin/booster-set keywords).  For new products: always generate.
    p.keywords = generateKeywords(p.name, p.category);

    const existing = p.sku
      ? existingMap["sku:" + p.sku]
      : p.productId
        ? existingMap["pid:" + p.productId]
        : null;

    if (existing) {
      p.salesCount = existing.salesCount;
      p.newProduct = true;
      // Clear manualPosition on HHC sync to reset ordering
      p.manualPosition = null;
      // Preserve admin/booster keywords if already set — don't overwrite
      // with freshly generated ones.
      if (Array.isArray(existing.keywords) && existing.keywords.length > 0) {
        delete p.keywords;
      }
      updateOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: p },
        },
      });
      updated++;
    } else {
      p.slug = p.slug || slugify(p.name) || slugify(p.sku) || slugify(p.productId) || undefined;
      // New arrivals surface on the landing "Curated Picks" (featuredOnLanding
      // true, sorted by updatedAt) — so a fetch/sync visibly refreshes the
      // main page in the single clean products_updated swap.
      p.featuredOnLanding = true;
      insertDocs.push(p);
    }
  }

  // Execute bulk update
  if (updateOps.length > 0) {
    const result = await Product.bulkWrite(updateOps);
    updated = result.modifiedCount + result.upsertedCount;
  }

  // Bulk insert new products
  if (insertDocs.length > 0) {
    if (syncState.aborted) {
      // Still count as created for tracking
    } else {
      const docs = await Product.insertMany(insertDocs);
      for (const doc of docs) {
        syncState.createdProductIds.push(doc._id);
      }
      created = docs.length;
    }
  }

  if (emit) {
    emit("db_progress", `DB: ${created} created, ${updated} updated`, { created, updated });
  }

  // During syncAll, per-page emits would spam every connected client with a
  // refresh per page. Only quickFetch (single batch) emits here; syncAll emits
  // ONE products_updated at the very end with full totals.
  if (io && (created > 0 || updated > 0) && !syncState.running) {
    io.emit("products_updated", { source: "hhc-import", created, updated });
  }

  return { created, updated, skipped, errors: 0 };
}

// ── Test Token ─────────────────────────────────────────────────────────────
const testToken = async (req, res) => {
  try {
    const token = await resolveHhcToken(req.body.token);
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Bearer token is required." });
    }

    const result = await proxyRequestSimple(
      "/dropshipper/products?page=1&paginate=1",
      token,
    );
    return res.status(200).json({
      success: true,
      valid: result.status === 200,
      status: result.status,
      data: result.data,
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      valid: false,
      message: err.message,
    });
  }
};

// ── Quick Fetch ────────────────────────────────────────────────────────────
const quickFetch = async (req, res) => {
  try {
    const token = await resolveHhcToken(req.body.token);
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Bearer token is required." });
    }

    const io = req.app.get("io");
    const emit = (event, data) => {
      if (io) io.emit(event, { requestId: "quick", ...data });
    };

    emit("hhc_progress", {
      type: "quick_fetch",
      message: "Quick fetching all products from HHC...",
    });

    const result = await proxyRequestSimple("/dropshipper/products", token);
    const products = extractProducts(result.data);
    const rawProductCount = products ? products.length : 0;

    emit("hhc_progress", {
      type: "quick_fetch",
      message: `API returned ${rawProductCount} product(s). Saving to MongoDB...`,
      productCount: rawProductCount,
    });

    let dbResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
    if (products && products.length > 0) {
      dbResult = await saveProductsToDB(products, io, emit);
    }

    emit("hhc_progress", {
      type: "quick_fetch",
      message: `Done! Created ${dbResult.created}, Updated ${dbResult.updated}, Skipped ${dbResult.skipped}, Errors ${dbResult.errors}`,
      productCount: rawProductCount,
      ...dbResult,
    });

    // NOTE: no out-of-stock purge here. Quick fetch only imports — purging
    // right after creation would instantly delete freshly-created stock-0
    // products (created → deleted → nothing to show). Full syncAll runs the
    // purge in its final phase after the 5-minute grace period.
    const outOfStockDeleted = 0;

    // Auto-apply pricing rules (price range → category → global) if configured
    try {
      const rules = await loadPricingRules();
      if (rules.globalPricing != null || (rules.priceRanges && rules.priceRanges.length > 0)) {
        const pct = Number(rules.globalPricing);
        const allProducts = await Product.find({ wholesalePrice: { $gt: 0 } });
        const ops = [];
        for (const product of allProducts) {
          const priced = priceProductFromRules(product.wholesalePrice, product.category, product.lowPrice === true, rules);
          if (!priced) continue;
          if (!Number.isFinite(priced.retail) || priced.retail < 0) continue;
          const newRetail = priced.retail;
          if (newRetail !== product.retailPrice || priced.lowPrice !== (product.lowPrice === true)) {
            ops.push({
              updateOne: {
                filter: { _id: product._id },
                update: { $set: { retailPrice: newRetail, lowPrice: priced.lowPrice, manualPosition: null } },
              },
            });
          }
        }
        if (ops.length > 0) {
          const result = await Product.bulkWrite(ops);
          emit("hhc_progress", {
            type: "quick_fetch",
            message: `Applied ${pct}% markup to ${result.modifiedCount} products.`,
            appliedPricing: result.modifiedCount,
          });
        }
      }
    } catch (err) {
      emit("hhc_progress", {
        type: "quick_fetch",
        message: `Auto-pricing failed: ${err.message}`,
      });
    }

    return res.status(200).json({
      success: true,
      status: result.status,
      apiProductCount: rawProductCount,
      dbResult,
      outOfStockDeleted,
      firstProductKeys: products && products.length > 0 ? Object.keys(products[0]) : [],
      data: result.data,
    });
  } catch (err) {
    console.error("HHC quickFetch error:", err);
    return res.status(502).json({
      success: false,
      message: "Quick fetch failed.",
      error: err.message,
    });
  }
};

// ── Get sync status (for frontend tab-switch recovery) ─────────────────────
const getSyncStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    running: syncState.running,
    requestId: syncState.requestId,
    logs: syncState.logs,
    summary: syncState.summary,
  });
};

// ── Get server-stored token (prefills the admin UI) ────────────────────────
const getHhcToken = async (req, res) => {
  const token = await getStoredHhcToken();
  return res.status(200).json({ success: true, saved: !!token, token });
};

// ── Stop sync ──────────────────────────────────────────────────────────────
const stopSync = (req, res) => {
  syncState.aborted = true;
  syncState.running = false;
  const entry = addLog("stopped", "Sync stopped by admin.");
  const io = req.app.get("io");
  if (io) {
    io.emit("hhc_progress", { requestId: syncState.requestId, ...entry });
  }
  return res.status(200).json({ success: true, message: "Sync stopped." });
};

// ── Sync All Products ─────────────────────────────────────────────────────
// Rate limiting: max 10 pages per minute with 5-7s gap between each request.
// After every batch of 10, waits for the remainder of the 60s window.
// Tags synced products with newProduct: true.
// After completion, waits 5 minutes, then deletes old (un-synced) products.
const syncAll = async (req, res) => {
  try {
    const token = await resolveHhcToken(req.body.token);
    const { totalPages } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Bearer token is required." });
    }

    if (syncState.running) {
      return res.status(409).json({
        success: false,
        message: "A sync is already in progress. Stop it first or wait for it to finish.",
      });
    }

    const io = req.app.get("io");
    const requestId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // Reset and initialize sync state
    resetSyncState();
    syncState.requestId = requestId;
    syncState.running = true;
    syncState.batchStartTime = Date.now();

    const emit = (type, message, extra = {}) => {
      const entry = addLog(type, message, extra);
      if (io) {
        io.emit("hhc_progress", { requestId, ...entry });
      }
    };

    // ── Phase 1: Discover total pages ────────────────────────────────────
    let actualTotalPages = totalPages ? Number(totalPages) : null;

    if (!actualTotalPages) {
      try {
        const discResult = await proxyRequest(
          "/dropshipper/products?page=1&paginate=40&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=",
          token,
          emit,
          1,
        );

        if (syncState.aborted) {
          emit("stopped", "Sync aborted during discovery.");
          return res.status(200).json({ success: true, message: "Sync aborted." });
        }

        if (discResult.status === 200 && discResult.data) {
          const total = discResult.data.total || discResult.data.totalCount || discResult.data.count || discResult.data.recordsTotal || null;
          if (total) {
            actualTotalPages = Math.ceil(Number(total) / 40);
            emit("discovery", `Found ${total} products = ${actualTotalPages} pages.`, { totalProducts: Number(total), totalPages: actualTotalPages });
          } else {
            actualTotalPages = 211;
            emit("discovery", `Defaulting to ${actualTotalPages} pages.`, { totalPages: actualTotalPages });
          }
        } else {
          actualTotalPages = 211;
          emit("discovery", `Defaulting to ${actualTotalPages} pages.`, { totalPages: actualTotalPages });
        }
      } catch (err) {
        actualTotalPages = 211;
        emit("discovery", `Defaulting to ${actualTotalPages} pages.`, { totalPages: actualTotalPages });
      }
    }

    // ── Phase 2: Fetch all pages ─────────────────────────────────────────
    // Rate limiting: 10 pages per batch, 5-7s gap between each, wait for minute boundary after each batch
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let pagesFetched = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const PAGES_PER_BATCH = 10;
    const BATCH_WINDOW_MS = 60000;

    emit("sync_started", `Syncing ${actualTotalPages} pages...`, { totalPages: actualTotalPages });

    for (let page = 1; page <= actualTotalPages; page++) {
      if (syncState.aborted) {
        emit("stopped", "Sync aborted by admin.");
        break;
      }

      if (page > 1) {
        const delayMs = await randomDelay();
      }

      if ((page - 1) % PAGES_PER_BATCH === 0 && page > 1) {
        const elapsed = Date.now() - syncState.batchStartTime;
        const remaining = BATCH_WINDOW_MS - elapsed;
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
        syncState.batchStartTime = Date.now();
      }

      const endpoint = `/dropshipper/products?page=${page}&paginate=40&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=`;

      try {
        const result = await proxyRequest(endpoint, token, emit, page);

        if (syncState.aborted) break;

        if (result.status !== 200) {
          consecutiveFailures++;
          emit("error", `Page ${page} error (${result.status}) [${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}]`, { page, status: result.status });

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && page > 5) {
            emit("stopped", `Stopped after ${consecutiveFailures} consecutive failures at page ${page}.`, { page });
            break;
          }
          continue;
        }

        consecutiveFailures = 0;
        const products = extractProducts(result.data);

        if (!products || products.length === 0) {
          pagesFetched++;
          if (page > 1) {
            emit("stopped", `Empty page ${page} — all products fetched.`, { page });
            break;
          }
          continue;
        }

        emit("progress", `Page ${page}/${actualTotalPages} — ${products.length} products`, { page, totalPages: actualTotalPages, productCount: products.length });

        const dbResult = await saveProductsToDB(products, io, emit, page);

        if (syncState.aborted) break;

        totalCreated += dbResult.created;
        totalUpdated += dbResult.updated;
        totalSkipped += dbResult.skipped;
        totalErrors += dbResult.errors;
        pagesFetched++;
      } catch (err) {
        consecutiveFailures++;
        emit("error", `Page ${page} failed: ${err.message}`, { page, error: err.message });
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && page > 5) break;
      }
    }

    if (syncState.aborted) {
      // Delete only the newly created products (not the updated existing ones)
      let deletedNew = 0;
      if (syncState.createdProductIds.length > 0) {
        const delResult = await Product.deleteMany({ _id: { $in: syncState.createdProductIds } });
        deletedNew = delResult.deletedCount || 0;
      }
      syncState.running = false;
      syncState.summary = { totalCreated, totalUpdated, totalSkipped, totalErrors, pagesFetched, aborted: true, deletedNew };
      emit("sync_complete", `Sync aborted. ${deletedNew} newly created products removed. ${totalCreated} created, ${totalUpdated} updated before stop.`);
      if (io) {
        io.emit("products_updated", { source: "hhc-sync", aborted: true, totalCreated, totalUpdated, deletedCount: deletedNew });
      }
      return res.status(200).json({
        success: true,
        requestId,
        aborted: true,
        summary: syncState.summary,
      });
    }

    // ── Phase 3: 5-minute grace period ───────────────────────────────────
    emit("grace_period", `All pages fetched. Waiting 5 min before cleanup...`, { totalCreated, totalUpdated, pagesFetched });

    // Check for abort during grace period by splitting the wait
    const GRACE_MS = 5 * 60 * 1000;
    const CHECK_INTERVAL = 5000;
    for (let waited = 0; waited < GRACE_MS; waited += CHECK_INTERVAL) {
      if (syncState.aborted) break;
      await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
    }

    if (syncState.aborted) {
      let deletedNew = 0;
      if (syncState.createdProductIds.length > 0) {
        const delResult = await Product.deleteMany({ _id: { $in: syncState.createdProductIds } });
        deletedNew = delResult.deletedCount || 0;
      }
      syncState.running = false;
      syncState.summary = { totalCreated, totalUpdated, totalSkipped, totalErrors, pagesFetched, aborted: true, deletedNew };
      emit("sync_complete", `Sync aborted during grace period. ${deletedNew} newly created products removed. ${totalCreated} created, ${totalUpdated} updated.`);
      if (io) {
        io.emit("products_updated", { source: "hhc-sync", aborted: true, totalCreated, totalUpdated, deletedCount: deletedNew });
      }
      return res.status(200).json({
        success: true,
        requestId,
        aborted: true,
        summary: syncState.summary,
      });
    }

    // ── Phase 4: Cleanup — delete old (un-synced) products ───────────────
    emit("cleanup", "Cleaning up old products...");

    let deletedCount = 0;
    try {
      // Notify customers whose confirmed orders contain a product that is
      // about to vanish from the catalog (removed from HHC entirely).
      const staleProducts = await Product.find({
        $or: [
          { newProduct: { $ne: true } },
          { newProduct: { $exists: false } },
        ],
      })
        .select("productId sku name")
        .lean();
      await notifyStockAlertCustomers(staleProducts, io);

      const deleteResult = await Product.deleteMany({
        _id: { $in: staleProducts.map((p) => p._id) },
      });
      deletedCount = deleteResult.deletedCount || 0;

      await Product.updateMany(
        { newProduct: true },
        { $unset: { newProduct: "", manualPosition: "" } },
      );

      emit("cleanup", `Cleanup: ${deletedCount} old products removed.`, { deletedCount });
    } catch (err) {
      emit("error", `Cleanup failed: ${err.message}`, { error: err.message });
    }

    // ── Phase 5: Remove all out-of-stock products ─────────────────────────
    // suppressSocket = true: skip the per-product `product_deleted` flood the
    // sync would otherwise emit for every deleted item — the single final
    // products_updated below covers the whole swap. Customer-facing
    // `order_product_out_of_stock` notifications still fire.
    const outOfStockDeleted = await deleteAllOutOfStock(io, { suppressSocket: true });
    if (outOfStockDeleted > 0) {
      emit("cleanup", `Deleted ${outOfStockDeleted} out-of-stock product(s).`, { outOfStockDeleted });
    }

    // ── Phase 6: Auto-apply pricing rules (range → category → global) ──────
    try {
      const rules = await loadPricingRules();
      if (rules.globalPricing != null || (rules.priceRanges && rules.priceRanges.length > 0)) {
        const pct = Number(rules.globalPricing);
        emit("pricing", `Applying ${pct}% global markup to all products...`);
        const allProducts = await Product.find({ wholesalePrice: { $gt: 0 } });
        const ops = [];
        for (const product of allProducts) {
          const priced = priceProductFromRules(product.wholesalePrice, product.category, product.lowPrice === true, rules);
          if (!priced) continue;
          if (!Number.isFinite(priced.retail) || priced.retail < 0) continue;
          const newRetail = priced.retail;
          if (newRetail !== product.retailPrice || priced.lowPrice !== (product.lowPrice === true)) {
            ops.push({
              updateOne: {
                filter: { _id: product._id },
                update: { $set: { retailPrice: newRetail, lowPrice: priced.lowPrice, manualPosition: null } },
              },
            });
          }
        }
        if (ops.length > 0) {
          const result = await Product.bulkWrite(ops);
          emit("pricing", `Applied ${pct}% markup to ${result.modifiedCount} products.`);
        } else {
          emit("pricing", `All products already priced at ${pct}% markup.`);
        }
        if (io) {
          io.emit("pricing_updated", { source: "hhc-sync", percentage: pct });
        }
      } else {
        emit("pricing", `No global markup configured — products priced at wholesale cost.`);
      }
    } catch (err) {
      emit("error", `Auto-pricing failed: ${err.message}`);
    }

    const remainingCount = await Product.countDocuments({});

    emit("sync_complete", `Sync complete! ${totalCreated} created, ${totalUpdated} updated, ${deletedCount} old removed, ${outOfStockDeleted} out-of-stock removed. ${remainingCount} products remain.`, {
      totalCreated, totalUpdated, totalSkipped, totalErrors, pagesFetched, deletedCount, outOfStockDeleted, remainingCount,
    });

    if (io) {
      io.emit("products_updated", {
        source: "hhc-sync",
        totalCreated, totalUpdated, deletedCount, outOfStockDeleted, remainingCount,
      });
    }

    syncState.running = false;
    syncState.summary = {
      totalCreated, totalUpdated, totalSkipped, totalErrors,
      pagesFetched, deletedCount, outOfStockDeleted, remainingCount,
    };

    return res.status(200).json({
      success: true,
      requestId,
      summary: syncState.summary,
    });
  } catch (err) {
    console.error("HHC syncAll error:", err);
    syncState.running = false;
    return res.status(500).json({
      success: false,
      message: "Sync failed.",
      error: err.message,
    });
  }
};

module.exports = {
  testToken,
  quickFetch,
  syncAll,
  getSyncStatus,
  stopSync,
  getHhcToken,
  buildHeaders,
  proxyRequest,
  proxyRequestSimple,
  randomDelay,
  getStoredHhcToken,
  saveStoredHhcToken,
  resolveHhcToken,
};
