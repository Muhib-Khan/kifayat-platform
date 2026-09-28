// ONE combined job:
//  Phase 1 — sweep the HHC catalog (list endpoint) to get every product's
//            REAL slug (detail.slug), and bulk-update our DB products' slugs
//            by productId (fixes "dead" products that HHC renamed).
//  Phase 2 — bulk-fetch dynamic data (images/videos/variations) for every DB
//            product that's live on HHC, using the catalog slugs directly.
//            Resumable: products that already have a DynamicData record (by
//            product ref) are skipped, so re-running finishes the remainder.
//
// Usage: node scripts/refresh_all_dynamic.js [--dry-run]
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");
const { proxyRequest, resolveHhcToken } = require("../controllers/hhcApiController");
const { fetchAndSaveDynamicData } = require("../controllers/dynamicDataController");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGINATE = 40;
const LIST_CONCURRENCY = 10;
const SLUG_CONCURRENCY = 40;

// ── Phase 1: catalog sweep ──────────────────────────────────────────────────
async function sweepCatalog(token) {
  const first = await proxyRequest(
    `/dropshipper/products?page=1&paginate=${PAGINATE}&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=`,
    token,
    null,
    1
  );
  if (first.status !== 200) throw new Error(`catalog page 1 -> ${first.status}`);
  const total = Number(first.data?.total || first.data?.recordsTotal || 0);
  const pages = Math.max(1, Math.ceil(total / PAGINATE));
  console.log(`[1/2] catalog: ${total} products = ${pages} pages`);

  const extract = (data) =>
    Array.isArray(data) ? data : (data?.data || data?.products || data?.items || []);

  const items = [];
  let next = 2;
  let fetched = 1;

  async function worker() {
    while (next <= pages) {
      const page = next++;
      try {
        const r = await proxyRequest(
          `/dropshipper/products?page=${page}&paginate=${PAGINATE}&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=`,
          token,
          null,
          page
        );
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
        console.log(`  [1/2] pages fetched: ${fetched}/${pages} (${items.length} items)`);
      }
    }
  }

  await Promise.all(Array.from({ length: LIST_CONCURRENCY }, () => worker()));
  items.push(...extract(first.data));
  console.log(`[1/2] fetched ${items.length} catalog items`);

  const byId = new Map();
  for (const it of items) {
    const slug = String(it.detail?.slug || "").trim();
    if (it.id == null || !slug) continue;
    byId.set(String(it.id), { slug, name: String(it.name || "").trim() });
  }
  console.log(`[1/2] items with slug: ${byId.size}`);

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
  console.log(`[1/2] slug updates: ${bulkOps.length} (${changedIds.length} slug changes)`);
  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false });
    if (changedIds.length > 0) {
      const del = await DynamicData.deleteMany({ product: { $in: changedIds } });
      console.log(`[1/2] cleaned ${del.deletedCount} stale DynamicData record(s)`);
    }
  }
  return byId;
}

// ── Phase 2: bulk dynamic fetch ─────────────────────────────────────────────
async function fetchDynamic(token, byId) {
  const dbProducts = await Product.find({})
    .select("productId slug name")
    .lean();
  const doneRefs = new Set(
    (await DynamicData.find({}).select("product").lean())
      .map((d) => String(d.product || ""))
      .filter(Boolean)
  );

  const todo = [];
  let notInCatalog = 0;
  for (const p of dbProducts) {
    const pid = String(p.productId || "");
    if (!pid || !byId.has(pid)) {
      notInCatalog++;
      continue;
    }
    if (doneRefs.has(String(p._id))) continue;
    todo.push({
      _id: p._id,
      productId: pid,
      name: p.name || "",
      slug: byId.get(pid).slug,
    });
  }
  console.log(
    `[2/2] todo: ${todo.length} products (${notInCatalog} not on HHC, ${doneRefs.size} already fetched)`
  );

  let ok = 0;
  let withVideo = 0;
  let withVariations = 0;
  let notFound = 0;
  let unprocessable = 0;
  let perProduct403 = 0;
  let failed = 0;
  let next = 0;
  let backoff = 0;
  const t0 = Date.now();

  async function worker() {
    while (next < todo.length) {
      const p = todo[next++];
      if (backoff > 0) await sleep(backoff);
      try {
        const { images, videos, variations } = await fetchAndSaveDynamicData(p, token);
        ok++;
        if (videos.length > 0) withVideo++;
        if (variations.length > 0) withVariations++;
        if (backoff > 0) backoff = 0;
      } catch (err) {
        const status = err.hhcStatus;
        const msg = String(err.message || "");
        if (status === 404) {
          notFound++;
        } else if (status === 429 || (status === 403 && /unauthorized|token|expired|invalid/i.test(msg))) {
          backoff = backoff ? Math.min(backoff * 2, 60000) : 10000;
          console.log(`  [2/2] ${status} throttle -> backoff ${backoff}ms: ${msg.slice(0, 80)}`);
        } else if (status === 403) {
          perProduct403++;
        } else if (status === 422) {
          unprocessable++;
        } else {
          failed++;
        }
      }
      if (next % 100 === 0 || next === todo.length) {
        const mins = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(
          `  [2/2] ${next}/${todo.length} | ok:${ok} vids:${withVideo} vars:${withVariations} | 404:${notFound} 422:${unprocessable} 403:${perProduct403} err:${failed} | ${mins}min`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: SLUG_CONCURRENCY }, () => worker()));
  console.log(
    `[2/2] DONE — ok:${ok} (videos:${withVideo}, variations:${withVariations}) | 404:${notFound} | 422:${unprocessable} | 403:${perProduct403} | errors:${failed}`
  );
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);
  if (!token) {
    console.error("No HHC token — aborting.");
    process.exit(1);
  }
  const byId = await sweepCatalog(token);
  await fetchDynamic(token, byId);
  await mongoose.disconnect();
  console.log("ALL DONE");
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
