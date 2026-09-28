// Backfills HHC variations for products whose `variations` array is empty or
// missing. Fetches /dropshipper/product/slug/<slug> via fetchAndSaveDynamicData
// (which upserts BOTH the Product doc and the DynamicData record), so the
// storefront slug API serves variations immediately after each hit.
//
// Resumable: products already enriched (variations non-empty) or fetched in
// the last FRESHNESS_MS are skipped, so re-running only picks up leftovers.
//
// Usage: node scripts/backfill_variations.js [--limit N] [--concurrency C]
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");
const { resolveHhcToken } = require("../controllers/hhcApiController");
const { fetchAndSaveDynamicData } = require("../controllers/dynamicDataController");

const FRESHNESS_MS = 24 * 60 * 60 * 1000; // re-try products fetched >24h ago
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) || 0 : 0;
  const concIdx = process.argv.indexOf("--concurrency");
  const concurrency = concIdx >= 0 ? parseInt(process.argv[concIdx + 1], 10) || 25 : 25;

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);
  if (!token) {
    console.error("No HHC token saved in Settings.hhcToken — aborting.");
    process.exit(1);
  }

  const staleSince = new Date(Date.now() - FRESHNESS_MS);
  const dds = await DynamicData.find({ fetchedAt: { $gte: staleSince } }).select("slug").lean();
  const freshSlugs = new Set(dds.map((d) => d.slug).filter(Boolean));

  const candidates = await Product.find({ slug: { $ne: "" } })
    .select("name slug productId variations")
    .lean();
  const todo = candidates.filter(
    (p) =>
      !(Array.isArray(p.variations) && p.variations.length > 0) && !freshSlugs.has(p.slug)
  );
  if (limit > 0) todo.length = Math.min(todo.length, limit);

  console.log(
    `slugged: ${candidates.length} | already enriched: ${
      candidates.length - todo.length
    } | fetching: ${todo.length} (concurrency ${concurrency}, freshness window ${FRESHNESS_MS / 36e5}h)`
  );

  let ok = 0;
  let withVariations = 0;
  let withGallery = 0;
  let notFound = 0;
  let auth = 0;
  let unprocessable = 0;
  let failed = 0;
  let next = 0;
  let backoff = 0;

  async function worker() {
    while (next < todo.length) {
      const p = todo[next++];
      if (backoff > 0) await sleep(backoff);
      try {
        const { images, variations, gallery } = await fetchAndSaveDynamicData(p, token);
        ok++;
        if (variations.length > 0) withVariations++;
        if (gallery.length > 0) withGallery++;
        if (backoff > 0) backoff = 0;
        console.log(
          `OK   ${p.slug.slice(0, 55)} | imgs:${images.length} vars:${variations.length}`
        );
      } catch (err) {
        const status = err.hhcStatus;
        if (status === 404) {
          notFound++;
          console.log(`404  ${p.slug.slice(0, 55)} (not on HHC)`);
        } else if (status === 403 || status === 429) {
          auth++;
          backoff = backoff ? Math.min(backoff * 2, 60000) : 10000;
          console.log(`${status}  ${p.slug.slice(0, 55)} | backoff ${backoff}ms | ${String(err.message).slice(0, 80)}`);
        } else if (status === 422) {
          unprocessable++;
          console.log(`422  ${p.slug.slice(0, 55)} | ${String(err.message).slice(0, 100)}`);
        } else {
          failed++;
          console.log(`ERR  ${p.slug.slice(0, 55)} | ${String(err.message).slice(0, 100)}`);
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log(
    `\nDONE — processed ${todo.length} | ok:${ok} (variations:${withVariations}, gallery:${withGallery}) | 404:${notFound} | 403/429:${auth} | 422:${unprocessable} | errors:${failed}`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
