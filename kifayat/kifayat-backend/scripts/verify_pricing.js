const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const products = db.collection('products');

  const top = await products.findOne({}, { sort: { retailPrice: -1 } });
  console.log('Highest retailPrice product:', top.name);
  console.log('  wholesalePrice:', top.wholesalePrice);
  console.log('  retailPrice:', top.retailPrice);

  const priced = await products.countDocuments({ retailPrice: { $gt: 0 } });
  const zero = await products.countDocuments({ retailPrice: 0 });
  const total = await products.countDocuments({});
  console.log('Products with retailPrice>0:', priced + '/' + total);
  console.log('Products with retailPrice=0:', zero);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
