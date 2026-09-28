// One-off verification: exercises the exact code path used by the
// "Get Product Dynamic Data" admin button (fetchAndSaveDynamicData) against
// the live DB + live HHC API, on both the create-path (no DynamicData record
// yet) and the update-path (record already exists).
//
// Usage: node scripts/verify_dynamic_data.js
require("dotenv").config({ debug: true });
const mongoose = require("mongoose");

const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");
const Settings = require("../models/Settings");
const { resolveHhcToken } = require("../controllers/hhcApiController");
const {
  fetchAndSaveDynamicData,
  extractImages,
} = require("../controllers/dynamicDataController");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
  });
  console.log("DB connected\n");

  const token = await resolveHhcToken(undefined);
  console.log("stored HHC token present:", Boolean(token));

  const withData = await DynamicData.findOne({}).lean();
  const withSlug = await Product.findOne({ slug: { $ne: "", $exists: true } }).lean();

  const targets = [];
  if (withData) {
    const prod = await Product.findById(withData.product).lean();
    if (prod && (prod.slug || "").trim()) {
      targets.push({ label: "UPDATE-path (record exists)", product: prod });
    }
  }
  if (withSlug) {
    targets.push({ label: "CREATE-path (record exists? no)", product: withSlug });
  }

  for (const t of targets.slice(0, 2)) {
    const { product } = t;
    console.log(`\n=== ${t.label} ===`);
    console.log("product:", product._id.toString(), "|", product.name, "|", product.slug);

    const { images, variations, dynamicData } = await fetchAndSaveDynamicData(product, token);
    console.log("images:", images.length, "| variations:", variations.length);
    console.log("images[0..2]:", JSON.stringify(images.slice(0, 3), null, 1));

    const fresh = await Product.findById(product._id).lean();
    console.log("Product.imageUrl (multi, comma-joined):", (fresh.imageUrl || "").split(",").length, "url(s)");
    console.log("Product.variations:", Array.isArray(fresh.variations) ? fresh.variations.length : fresh.variations);
    console.log("DynamicData._id:", dynamicData._id.toString(), "| images:", dynamicData.images.length, "| variations:", Array.isArray(dynamicData.variations) ? dynamicData.variations.length : dynamicData.variations);
    await sleep(500);
  }

  console.log("\n---- extractImages unit checks ----");
  console.log("gallery w/ mp4 filtered:", extractImages({ product_thumbnail: { original_url: "a.jpg" }, product_galleries: [{ original_url: "b.mp4" }, { original_url: "c.png" }, { original_url: "c.png" }] }));
  console.log("string thumbnail:", extractImages({ product_thumbnail: "https://x/t.webp", product_galleries: [] }));
  console.log("null data:", extractImages(null));

  await mongoose.disconnect();
  console.log("\nDONE");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
