// Re-fetch dynamic data for the variation product (wallet) + print gallery
// breakdown (images vs videos) so the storefront gallery can be verified.
require("dotenv").config();
const mongoose = require("mongoose");

const Product = require("../models/Product");
const { resolveHhcToken } = require("../controllers/hhcApiController");
const {
  fetchAndSaveDynamicData,
} = require("../controllers/dynamicDataController");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);

  const wallet = await Product.findOne({
    slug: "original-cuicka-branded-wallet-for-men-black-and-brown-premium-leather-with-multiple-compartments-durable-stylish-practical-choice-reliable-performance",
  }).lean();

  const { images, videos, variations, gallery } = await fetchAndSaveDynamicData(wallet, token);
  console.log("images:", images.length, "| videos:", videos.length, "| variations:", variations.length);
  console.log("gallery items:", gallery.map((g) => `${g.type}:${String(g.id)}`).join(", "));

  const fresh = await Product.findById(wallet._id).lean();
  console.log("Product.gallery:", fresh.gallery.length, "items");
  console.log("Product.variations:", Array.isArray(fresh.variations) ? fresh.variations.length : fresh.variations);
  console.log("Product.variations[0]:", JSON.stringify(fresh.variations[0]).slice(0, 300));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
