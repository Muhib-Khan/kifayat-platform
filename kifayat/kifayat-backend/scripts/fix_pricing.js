const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Settings = require('../models/Settings');
  const Product = require('../models/Product');

  const zeroPrice = await Product.countDocuments({ retailPrice: 0, wholesalePrice: { $gt: 0 } });
  console.log('Products with retailPrice=0 and wholesalePrice>0:', zeroPrice);

  const settings = await Settings.findOne({});
  const pct = settings?.globalPricing;
  console.log('Global pricing markup:', pct ? pct + '%' : 'none configured');

  const allProducts = await Product.find({ wholesalePrice: { $gt: 0 } });
  const ops = [];
  for (const product of allProducts) {
    const retail = product.retailPrice;
    const wholesale = product.wholesalePrice;
    let newRetail;
    if (pct && wholesale > 0) {
      newRetail = Math.round(wholesale * (1 + pct / 100));
    } else {
      newRetail = wholesale;
    }
    if (newRetail !== retail) {
      ops.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { retailPrice: newRetail } },
        },
      });
    }
  }

  if (ops.length > 0) {
    const result = await Product.bulkWrite(ops);
    console.log('Updated', result.modifiedCount, '/', allProducts.length, 'products');
    console.log('retailPrices set using', pct ? pct + '% markup' : 'wholesale price as default');
  } else {
    console.log('All products already have correct pricing');
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
