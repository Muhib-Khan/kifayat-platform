// Scans products that have a slug until it finds one whose HHC dynamic API
// response contains variations, then runs fetchAndSaveDynamicData on it to
// prove the variations flow end-to-end. Prints a summary of each scanned slug.
require("dotenv").config();
const mongoose = require("mongoose");

const Product = require("../models/Product");
const { resolveHhcToken } = require("../controllers/hhcApiController");
const { proxyRequest } = require("../controllers/hhcApiController");
const {
  fetchAndSaveDynamicData,
} = require("../controllers/dynamicDataController");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);
  console.log("token present:", Boolean(token));

  const products = await Product.find({ slug: { $ne: "", $exists: true } }).limit(300).lean();
  console.log("products with slug to scan:", products.length);

  let scanned = 0;
  let ok = 0;
  let notFound = 0;
  let other = 0;

  for (const p of products) {
    if (scanned >= 25) break;
    scanned++;
    const endpoint = `/dropshipper/product/slug/${encodeURIComponent(p.slug)}`;
    let result;
    try {
      result = await proxyRequest(endpoint, token, null, 1);
    } catch (err) {
      other++;
      console.log(`${p.slug} -> ERROR ${err.message}`);
      continue;
    }

    if (result.status !== 200) {
      if (result.status === 404) notFound++;
      else other++;
      console.log(`${p.slug} -> ${result.status}`);
      await sleep(4500);
      continue;
    }

    ok++;
    const data = result.data && typeof result.data === "object" ? result.data : {};
    const vars = Array.isArray(data.variations) ? data.variations : [];
    const galleries = Array.isArray(data.product_galleries) ? data.product_galleries.length : 0;
    console.log(`${p.slug} -> 200 (galleries: ${galleries}, variations: ${vars.length})`);

    if (vars.length > 0) {
      console.log("\n=== FOUND variations product ===");
      const saved = await fetchAndSaveDynamicData(p, token);
      const fresh = await Product.findById(p._id).lean();
      console.log("images:", saved.images.length, "| variations:", saved.variations.length);
      console.log("variations sample:", JSON.stringify(saved.variations.slice(0, 2), null, 1).slice(0, 600));
      console.log("Product.imageUrl count:", fresh.imageUrl.split(",").length);
      console.log("Product.variations count:", Array.isArray(fresh.variations) ? fresh.variations.length : fresh.variations);
      break;
    }

    await sleep(4500);
  }

  console.log(`\nscanned: ${scanned} | 200: ${ok} | 404: ${notFound} | other: ${other}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
