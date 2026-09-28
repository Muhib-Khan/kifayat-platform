// One-time migration: extend the product $text search index to include the
// `keywords` array (per-product SEO), and backfill generated keywords for every
// product that doesn't have one yet — so ALL products are searchable by
// phrases like "best hand gripper" immediately.
//
// MongoDB $text indexes are IMMUTABLE — a field cannot be added to an existing
// text index, and creating a second text index on the same collection fails
// with IndexOptionsConflict. The fix is to drop the old text index and let
// Mongoose rebuild it from the schema.
//
// This script is idempotent: it only drops a text index whose keys differ from
// the schema's current set, then calls Product.init() to (re)create the schema
// index, then backfills keywords for products that have none. Safe to run
// multiple times.
//
// Usage: node scripts/migrate-text-index.js
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { generateKeywords } = require("../utils/seoKeywords");

// The key set the schema now declares. MongoDB describes text fields with the
// literal value "text".
const SCHEMA_TEXT_KEYS = {
  name: "text",
  description: "text",
  sku: "text",
  productId: "text",
  keywords: "text",
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set — aborting.");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const list = await Product.collection.listIndexes().toArray().catch(() => []);
  let changed = false;

  for (const index of list) {
    const key = index.key ?? {};
    // A text index is the collection's only index whose keys use the
    // literal "text" weight (and carries the hidden _fts metadata).
    const isText = Object.values(key).includes("text");
    if (!isText) continue;

    const sameSet =
      Object.keys(key).sort().join(",") === Object.keys(SCHEMA_TEXT_KEYS).sort().join(",");
    if (sameSet) {
      console.log(`Text index '${index.name}' already matches the schema — nothing to do.`);
      // No changed text index → already migrated or trivial; skip the drop.
      continue;
    }

    console.log(`Dropping legacy text index '${index.name}' (keys: ${Object.keys(key).join(", ")})...`);
    await Product.collection.dropIndex(index.name);
    changed = true;
    break; // there can be at most one text index per collection
  }

  if (changed) {
    console.log("Rebuilding schema text index (name, description, sku, productId, keywords)...");
    await Product.init();
    const rebuilt = await Product.collection.listIndexes().toArray().catch(() => []);
    const textIdx = rebuilt.find((i) => Object.values(i.key ?? {}).includes("text"));
    if (textIdx) {
      console.log(`New text index ready: '${textIdx.name}' -> ${JSON.stringify(textIdx.key)}`);
    } else {
      console.error("WARNING: no text index found after rebuild — check server logs.");
    }
  } else {
    // Fresh DB or Mongoose already created the schema index at connect time.
    console.log("No legacy text index found to migrate.");
  }

  // ── Backfill keywords for products that have none ────────────────────────
  // Covers products created before this feature: they hold keywords null /
  // "" / [] and were never touched by sync or the AI booster. Generate base
  // keywords from name + category so search finds them immediately.
  const missingFilter = {
    $or: [
      { keywords: { $exists: false } },
      { keywords: null },
      { keywords: [] },
      { keywords: { $size: 0 } },
    ],
  };
  const missing = await Product.find(missingFilter)
    .select("_id name category")
    .lean();

  if (missing.length === 0) {
    console.log("Keyword backfill: all products already have keywords — nothing to do.");
  } else {
    console.log(`Keyword backfill: generating keywords for ${missing.length} products...`);
    const upserts = missing.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { keywords: generateKeywords(p.name, p.category) } },
        upsert: false,
      },
    }));
    const CHUNK = 500;
    let done = 0;
    for (let i = 0; i < upserts.length; i += CHUNK) {
      const chunk = upserts.slice(i, i + CHUNK);
      const res = await Product.bulkWrite(chunk);
      done += res.modifiedCount;
      console.log(`  keywords backfilled: ${done}/${missing.length}`);
    }
    console.log(`Keyword backfill complete — ${done} products updated.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});