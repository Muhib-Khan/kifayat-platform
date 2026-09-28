const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { CATEGORIES, categorizeProduct } = require('../utils/categorize');

const CANONICAL = new Set(CATEGORIES.map((c) => c.name));
const BATCH = 1000;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const products = await db
    .collection('products')
    .find({}, { projection: { _id: 1, name: 1, description: 1, category: 1 } })
    .toArray();

  console.log(`Loaded ${products.length} products.`);

  let updated = 0;
  let demotedSkipped = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const ops = [];

    for (const p of batch) {
      const oldCat = p.category || '';
      const newCat = categorizeProduct(p.name || '', p.description || '');
      if (newCat === oldCat) continue;
      // Never demote a product that already sits in a canonical category.
      if (CANONICAL.has(oldCat) && !CANONICAL.has(newCat)) {
        demotedSkipped++;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { category: newCat } },
        },
      });
    }

    if (ops.length > 0) {
      await db.collection('products').bulkWrite(ops, { ordered: false });
      updated += ops.length;
    }
    console.log(`  progress: ${Math.min(i + BATCH, products.length)}/${products.length} (updated so far: ${updated})`);
  }

  console.log(`\nDone: ${updated} products updated, ${demotedSkipped} canonical kept (skipped demotion).`);

  const after = {};
  const counts = await db
    .collection('products')
    .aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    .toArray();
  for (const c of counts) after[String(c._id)] = c.count;

  console.log('\nCategory breakdown (products collection):');
  for (const key of Object.keys(after).sort()) {
    console.log(`  ${String(key).padEnd(22)} ${after[key]}`);
  }

  for (const cat of CATEGORIES) {
    const n = after[cat.name] || 0;
    await db.collection('categories').updateOne({ slug: cat.slug }, { $set: { productCount: n } });
    console.log(`Category doc '${cat.name}': productCount = ${n}`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
