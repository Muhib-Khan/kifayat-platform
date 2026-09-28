// One-time migration: apply the low-price rule (retail < 500 => flat +270, no % margin).
//
// Usage:
//   node scripts/applyLowPriceRule.js            # dry-run (default, no writes)
//   node scripts/applyLowPriceRule.js --apply     # persist wholesale + 270 + lowPrice: true
//
// Candidates: products with retailPrice < 500 OR already flagged lowPrice: true.
// Products with wholesalePrice <= 0 are reported as skipped and NEVER changed.
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Product = require('../models/Product');
const { computeRetail, LOW_PRICE_FLAT_ADD } = require('../utils/pricing');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}\n`);

  const [under500, flagged] = await Promise.all([
    Product.find({ retailPrice: { $lt: 500 } }).lean(),
    Product.find({ lowPrice: true }).lean(),
  ]);

  // Dedupe candidates (a product can match both queries)
  const byId = new Map();
  [...under500, ...flagged].forEach((p) => {
    if (!byId.has(p._id.toString())) byId.set(p._id.toString(), p);
  });
  const candidates = [...byId.values()];

  const ops = [];
  let skipped = 0;

  for (const p of candidates) {
    const wholesale = Number(p.wholesalePrice) || 0;
    if (wholesale <= 0) {
      skipped++;
      console.log(
        `SKIP  ${p._id} slug=${p.slug || "-"} wholesale=${p.wholesalePrice} retail=${p.retailPrice} lowPrice=${p.lowPrice === true} — no wholesale cost, left unchanged`
      );
      continue;
    }
    const priced = computeRetail(wholesale, 0, true); // flagged => flat +270, pct irrelevant
    console.log(
      `PLAN  ${p._id} slug=${p.slug || "-"} wholesale=${wholesale} retail=${p.retailPrice} lowPrice=${p.lowPrice === true} -> retail=${priced.retail} lowPrice=${priced.lowPrice} (+${LOW_PRICE_FLAT_ADD})`
    );
    if (APPLY) {
      ops.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { retailPrice: priced.retail, lowPrice: priced.lowPrice } },
        },
      });
    }
  }

  console.log(`\nCandidates: ${candidates.length} (under 500: ${under500.length}, flagged lowPrice: ${flagged.length})`);
  console.log(`Skipped (wholesale <= 0, unchanged): ${skipped}`);

  if (APPLY && ops.length > 0) {
    const result = await Product.bulkWrite(ops);
    console.log(`Applied: ${result.modifiedCount} updated, ${result.matchedCount} matched`);
  } else if (APPLY) {
    console.log("Applied: nothing to write");
  } else {
    console.log("DRY-RUN complete — re-run with --apply to persist changes.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
