const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Category = require('../models/Category');
  const Product = require('../models/Product');
  const { categorizeProduct } = require('../utils/categorize');

  const allCategories = await Category.find({}).sort({ name: 1 }).lean();
  console.log(`Found ${allCategories.length} categories\n`);

  const topProducts = await Product.find({
    imageUrl: { $ne: '', $exists: true },
  }).sort({ salesCount: -1 }).limit(1000).lean();

  console.log(`Analyzing ${topProducts.length} top products...\n`);

  // Use categorizeProduct to find the best product per display category
  const catAssignments = {};
  for (const p of topProducts) {
    const matchedCat = categorizeProduct(p.name, p.description || '');
    if (!catAssignments[matchedCat]) {
      catAssignments[matchedCat] = p;
    }
  }

  // For Sports and Toys, also search by keywords in case categorize fails
  const sportKeywords = ['sport', 'gym', 'fitness', 'football', 'cricket', 'badminton', 'dumbbell', 'yoga', 'treadmill', 'bike', 'boxing', 'cycling', 'workout', 'exercise'];
  const toyKeywords = ['toy', 'kids', 'baby', 'children', 'game', 'puzzle', 'doll', 'stuffed', 'plush', 'rc car', 'action figure', 'board game'];

  if (!catAssignments['Sports']) {
    for (const kw of sportKeywords) {
      const found = await Product.findOne({
        name: { $regex: kw, $options: 'i' },
        imageUrl: { $ne: '', $exists: true },
      }).sort({ salesCount: -1 }).lean();
      if (found) { catAssignments['Sports'] = found; break; }
    }
  }

  if (!catAssignments['Toys']) {
    for (const kw of toyKeywords) {
      const found = await Product.findOne({
        name: { $regex: kw, $options: 'i' },
        imageUrl: { $ne: '', $exists: true },
      }).sort({ salesCount: -1 }).lean();
      if (found) { catAssignments['Toys'] = found; break; }
    }
  }

  // Assign images to categories
  let updated = 0;
  let total = allCategories.length;
  for (const cat of allCategories) {
    const name = cat.name;
    const assigned = catAssignments[name];

    if (assigned && assigned.imageUrl) {
      const imgUrl = assigned.imageUrl.split(',')[0].split('?')[0].trim();
      await Category.updateOne({ _id: cat._id }, { $set: { image: imgUrl } });
      console.log(`  ${name.padEnd(20)} → ${assigned.name.slice(0, 45).padEnd(47)} (sales: ${assigned.salesCount})`);
      updated++;
    } else {
      console.log(`  ${name.padEnd(20)} → NO MATCHING PRODUCT`);
    }
  }

  console.log(`\nUpdated ${updated}/${total} categories with images`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
