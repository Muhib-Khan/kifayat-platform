const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const aggs = await db.collection('products').aggregate([
    { $group: {
        _id: '$category',
        count: { $sum: 1 },
        withImg: { $sum: { $cond: [{ $and: [{ $ne: ['$imageUrl', ''] }, { $ne: ['$imageUrl', null] }] }, 1, 0] } },
        sample: { $first: '$imageUrl' },
      }
    },
    { $sort: { count: -1 } },
  ]).toArray();

  for (const a of aggs) {
    console.log(String(a._id).padEnd(22), a.count + ' products, ' + a.withImg + ' with images');
    if (a.sample) console.log('  sample:', String(a.sample).slice(0, 100));
  }

  // Also show categories collection
  const cats = await db.collection('settings').find({}).toArray();
  console.log('\n--- Categories from Category collection ---');
  const catDocs = await db.collection('categories').find({}).toArray();
  for (const c of catDocs) {
    console.log('  ' + c.name + ' (' + c.slug + ') image:', c.image);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
