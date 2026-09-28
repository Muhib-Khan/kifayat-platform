// Sweeps the full HHC catalog (list endpoint) to collect every product's
// CURRENT name + real slug (detail.slug), then updates matching DB products
// (by productId). Fixes "dead" products: HHC renames products with long SEO
// names, so our old name-derived slugs 404 on the dynamic endpoint.
// DynamicData records for changed slugs are removed so the next bulk fetch
// re-fetches them cleanly (one record per product).
//
// Usage: node scripts/catalog_slug_sweep.js [--dry-run]
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");
const { proxyRequest, resolveHhcToken } = require("../controllers/hhcApiController");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGINATE = 40;
const CONCURRENCY = 10;

async function fetchAllPages(token) {
  const first = await proxyRequest(
    `/dropshipper/products?page=1&paginate=${PAGINATE}&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=`,
    token,
    null,
    1
  );
  if (first.status !== 200) throw new Error(`first page ${first.status}`);
  const total = Number(first.data?.total || first.data?.recordsTotal || 0);
  const pages = Math.max(1, Math.ceil(total / PAGINATE));
  console.log(`catalog total: ${total} -> ${pages} pages`);

  const items = [];
  const extract = (data) =>
    Array.isArray(data) ? data : (data?.data || data?.products || data?.items || []);

  let next = 1;
  const seenPages = new Set([1]);
  items.push(...extract(first.data));

  async function worker() {
    while (next < pages) {
      const page = next++;
      if (seenPages.has(page)) continue;
      seenPages.add(page);
      try {
        const r = await proxyRequest(
          `/dropshipper/products?page=${page}&paginate=${PAGINATE}&search=&field=&price=&category=&sort=&sortBy=&weight=&attribute=`,
          token,
          null,
          page
        );
        if (r.status === 200) {
          items.push(...extract(r.data));
        } else if (r.status === 403 || r.status === 429) {
          console.log(`page ${page} -> ${r.status} (throttle)`);
          await sleep(10000);
        } else {
          console.log(`page ${page} -> ${r.status}`);
        }
      } catch (err) {
        console.log(`page ${page} -> ERR ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return items;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);
  if (!token) {
    console.error("No HHC token — aborting.");
    process.exit(1);
  }

  const items = await fetchAllPages(token);
  console.log(`fetched ${items.length} catalog items`);

  const byId = new Map();
  for (const it of items) {
    if (!it || it.id == null) continue;
    const slug = String(it.detail?.slug || "").trim();
    const name = String(it.name || "").trim();
    if (!slug) continue;
    byId.set(String(it.id), { slug, name });
  }
  console.log(`catalog items with slug: ${byId.size}`);

  const dbProducts = await Product.find({})
    .select("productId slug name")
    .lean();
  let matched = 0;
  let slugChanged = 0;
  let nameChanged = 0;
  const bulkOps = [];
  const changedIds = [];

  for (const p of dbProducts) {
    const pid = String(p.productId || "");
    if (!pid) continue;
    const hit = byId.get(pid);
    if (!hit) continue;
    matched++;
    if (hit.slug !== p.slug) slugChanged++;
    if (hit.name && hit.name !== p.name) nameChanged++;
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

  console.log(
    `DB products: ${dbProducts.length} | matched by productId: ${matched} | slug changed: ${slugChanged} | name changed: ${nameChanged}${dryRun ? " (DRY RUN)" : ""}`
  );

  if (!dryRun) {
    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps, { ordered: false });
      console.log(`bulk-written ${bulkOps.length} product update(s)`);
    }
    if (changedIds.length > 0) {
      const del = await DynamicData.deleteMany({ product: { $in: changedIds } });
      console.log(`deleted ${del.deletedCount} stale DynamicData record(s) for changed slugs`);
    }
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
