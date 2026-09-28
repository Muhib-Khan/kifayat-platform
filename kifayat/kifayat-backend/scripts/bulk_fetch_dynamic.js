// Bulk-fetches HHC dynamic data (images/videos/variations) for products that
// don't have a DynamicData record yet. Resumable — re-running skips products
// that already have data. Uses a concurrent worker pool (the HHC slug
// endpoint tolerates bursts) with exponential backoff on 403/429.
//
// Usage: node scripts/bulk_fetch_dynamic.js [--limit N] [--concurrency C]
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");
const { resolveHhcToken } = require("../controllers/hhcApiController");
const { fetchAndSaveDynamicData } = require("../controllers/dynamicDataController");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) || 0 : 0;
  const concIdx = process.argv.indexOf("--concurrency");
  const concurrency = concIdx >= 0 ? parseInt(process.argv[concIdx + 1], 10) || 10 : 10;

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);
  if (!token) {
    console.error("No HHC token saved in Settings.hhcToken — aborting.");
    process.exit(1);
  }

  const dds = await DynamicData.find({}).select("slug").lean();
  const doneSlugs = new Set(dds.map((d) => d.slug).filter(Boolean));

  const candidates = await Product.find({ slug: { $ne: "" } })
    .select("name slug productId")
    .lean();
  const todo = candidates.filter((p) => !doneSlugs.has(p.slug));
  if (limit > 0) todo.length = Math.min(todo.length, limit);

  console.log(
    `candidates: ${candidates.length} | already done: ${doneSlugs.size} | fetching: ${todo.length} (concurrency ${concurrency})`
  );

  let ok = 0;
  let withVideo = 0;
  let withVariations = 0;
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
        const { images, videos, variations } = await fetchAndSaveDynamicData(p, token);
        ok++;
        if (videos.length > 0) withVideo++;
        if (variations.length > 0) withVariations++;
        if (backoff > 0) backoff = 0;
        console.log(`OK   ${p.slug.slice(0, 60)} | imgs:${images.length} vids:${videos.length} vars:${variations.length}`);
      } catch (err) {
        const status = err.hhcStatus;
        if (status === 404) {
          notFound++;
          console.log(`404  ${p.slug.slice(0, 60)} (not on HHC)`);
        } else if (status === 403 || status === 429) {
          auth++;
          backoff = backoff ? Math.min(backoff * 2, 60000) : 10000;
          console.log(`${status}  ${p.slug.slice(0, 60)} | backoff ${backoff}ms | ${String(err.message).slice(0, 80)}`);
        } else if (status === 422) {
          unprocessable++;
          console.log(`422  ${p.slug.slice(0, 60)} | ${String(err.message).slice(0, 100)}`);
        } else {
          failed++;
          console.log(`ERR  ${p.slug.slice(0, 60)} | ${String(err.message).slice(0, 100)}`);
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log(
    `\nDONE — processed ${todo.length} | ok:${ok} (videos:${withVideo}, variations:${withVariations}) | 404:${notFound} | 403/429:${auth} | 422:${unprocessable} | errors:${failed}`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
