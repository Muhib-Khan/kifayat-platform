/**
 * One-time cleanup: drop the unused `rawData` blobs persisted on every Product
 * and DynamicData document (full HHC API payloads — never read by any code)
 * and (re)create the query indexes that make the catalogue fast.
 *
 * Run from kifayat-backend:  node scripts/cleanup-rawdata.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing — add it to kifayat-backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  console.log("Connected to MongoDB.");

  const prodRes = await Product.updateMany(
    { rawData: { $exists: true } },
    { $unset: { rawData: "" } },
  );
  console.log(`Products rawData removed: ${prodRes.modifiedCount}`);

  const dynRes = await DynamicData.updateMany(
    { rawData: { $exists: true } },
    { $unset: { rawData: "" } },
  );
  console.log(`DynamicData rawData removed: ${dynRes.modifiedCount}`);

  const prodIndexes = await Product.createIndexes();
  console.log("Product indexes:", prodIndexes);
  const dynIndexes = await DynamicData.createIndexes();
  console.log("DynamicData indexes:", dynIndexes);

  for (const [name, model] of [
    ["Product", Product],
    ["DynamicData", DynamicData],
  ]) {
    const [stats] = await model.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avg: { $avg: { $bsonSize: "$$ROOT" } },
          max: { $max: { $bsonSize: "$$ROOT" } },
          total: { $sum: { $bsonSize: "$$ROOT" } },
        },
      },
    ]);
    if (stats) {
      console.log(
        `${name}: ${stats.count} docs, ${(stats.total / 1024 / 1024).toFixed(2)} MB total, ` +
          `${(stats.avg / 1024).toFixed(1)} KB avg, ${(stats.max / 1024).toFixed(1)} KB max`,
      );
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});