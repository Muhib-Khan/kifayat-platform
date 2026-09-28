// Final counts of enriched products.
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const total = await Product.countDocuments({});
  const withGallery = await Product.countDocuments({ "gallery.0": { $exists: true } });
  const withVideo = await Product.countDocuments({ "gallery.type": "video" });
  const withVars = await Product.countDocuments({ "variations.0": { $exists: true } });
  console.log("products total:", total);
  console.log("with gallery (multi-image):", withGallery);
  console.log("with video(s):", withVideo);
  console.log("with variations:", withVars);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
