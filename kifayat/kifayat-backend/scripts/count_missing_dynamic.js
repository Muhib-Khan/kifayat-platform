// Counts how many products are missing dynamic data (gallery/videos/etc).
// Usage: node scripts/count_missing_dynamic.js
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const total = await Product.countDocuments({});
  const dds = await DynamicData.find({}).select("product productId slug").lean();
  const ddSlugs = new Set(dds.map((d) => d.slug).filter(Boolean));

  const withSlug = await Product.find({ slug: { $ne: "" } }).select("slug").lean();
  const noDd = withSlug.filter((p) => !ddSlugs.has(p.slug));

  const withGallery = await Product.countDocuments({ "gallery.0": { $exists: true } });

  console.log("total products:", total);
  console.log("with slug:", withSlug.length);
  console.log("DynamicData records:", dds.length);
  console.log("products with slug but NO dynamic data:", noDd.length);
  console.log("products with gallery:", withGallery);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
