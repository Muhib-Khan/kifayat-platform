// Backfills slugs for products that don't have one, using the same slugify
// convention as the HHC sync (controllers/hhcApiController.js:285).
// Collisions with existing slugs get a numeric suffix (-2, -3, ...).
//
// Usage: node scripts/backfill_missing_slugs.js [--dry-run]
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

function slugify(name) {
  if (!name) return "";
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200) || "product";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const missing = await Product.find({
    $or: [{ slug: { $exists: false } }, { slug: "" }, { slug: null }],
  })
    .select("name sku productId slug")
    .lean();
  console.log("products missing slug:", missing.length, dryRun ? "(DRY RUN)" : "");

  const existing = await Product.find({
    slug: { $ne: "", $exists: true },
  })
    .select("slug")
    .lean();
  const used = new Set(existing.map((p) => p.slug).filter(Boolean));

  const updates = [];
  for (const p of missing) {
    let base =
      slugify(p.name) || slugify(p.sku) || slugify(p.productId) || undefined;
    if (!base) {
      console.log("- SKIP (no name/sku/productId):", p._id.toString());
      continue;
    }
    let slug = base;
    let i = 2;
    while (used.has(slug)) {
      const suffix = `-${i}`;
      slug = base.substring(0, 200 - suffix.length) + suffix;
      i++;
    }
    used.add(slug);
    updates.push({ _id: p._id, slug });
    console.log("-", p.name ? JSON.stringify(p.name).slice(0, 60) : "(no name)", "->", slug);
  }

  if (!dryRun && updates.length > 0) {
    for (const u of updates) {
      await Product.updateOne({ _id: u._id }, { $set: { slug: u.slug } });
    }
    console.log("\nsaved", updates.length, "slug(s)");
  } else {
    console.log("\nwould save", updates.length, "slug(s)");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
