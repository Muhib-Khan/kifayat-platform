// One-time migration: top-up universal price increase from +100 to +150.
// The DB already received +100 (see add100AllProducts.js); this adds the
// remaining +50 so every product lands on the full +150.
//
// Usage:
//   node scripts/add50AllProducts.js            # dry-run (default, no writes)
//   node scripts/add50AllProducts.js --apply     # persist retailPrice += 50
//
// Only products with retailPrice > 0 are touched. The lowPrice flag and the
// low-price classification are NOT changed — classification happens on the
// pre-+100/+150 value, so the flag stays exactly as it is.
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Product = require('../models/Product');

const APPLY = process.argv.includes('--apply');
const TOP_UP_ADD = 50;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}\n`);

  const total = await Product.countDocuments({ retailPrice: { $gt: 0 } });
  console.log(`Products with retailPrice > 0: ${total}`);

  const sample = await Product.find({ retailPrice: { $gt: 0 } })
    .select("slug wholesalePrice retailPrice lowPrice")
    .limit(15)
    .lean();

  console.log(`\nSample (${sample.length} of ${total}):`);
  console.log("slug | wholesale | retail | lowPrice -> retail after +50");
  for (const p of sample) {
    console.log(
      `${p.slug || "-"} | ${p.wholesalePrice} | ${p.retailPrice} | ${p.lowPrice === true} -> ${Number(p.retailPrice) + TOP_UP_ADD}`
    );
  }

  if (APPLY) {
    const result = await Product.updateMany(
      { retailPrice: { $gt: 0 } },
      { $inc: { retailPrice: TOP_UP_ADD } }
    );
    console.log(`\nApplied: ${result.modifiedCount} modified, ${result.matchedCount} matched (+${TOP_UP_ADD} each)`);
  } else {
    console.log(`\nDRY-RUN complete — re-run with --apply to persist +${TOP_UP_ADD} on all ${total} products.`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
