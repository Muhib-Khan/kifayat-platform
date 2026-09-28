// Bulk re-categorize all products using keyword-based classifier
// Run with: node re-categorize-products.js

const mongoose = require("mongoose");
const { categorizeProduct } = require("./utils/categorize");
const Product = require("./models/Product");
const Category = require("./models/Category");
const { CATEGORIES } = require("./utils/categorize");

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/kifayat");
    console.log("Connected to MongoDB");

    // Ensure category documents exist
    for (const cat of CATEGORIES) {
      await Category.findOneAndUpdate(
        { slug: cat.slug },
        { $setOnInsert: { name: cat.name, slug: cat.slug } },
        { upsert: true, new: true }
      );
    }
    console.log("Categories verified/created");

    // Get all products
    const allProducts = await Product.find({}).select("_id name description category").lean();
    const total = allProducts.length;
    console.log(`Loaded ${total} products`);

    let updated = 0;
    let unchanged = 0;
    const bulkOps = [];

    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];
      const newCat = categorizeProduct(p.name || "", p.description || "");
      if (newCat !== p.category) {
        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { category: newCat } },
          },
        });
        updated++;
      } else {
        unchanged++;
      }

      // Progress indicator
      if ((i + 1) % 1000 === 0) {
        console.log(`Processed ${i + 1}/${total} products...`);
      }
    }

    if (bulkOps.length > 0) {
      console.log(`Updating ${bulkOps.length} products...`);
      await Product.bulkWrite(bulkOps);
      console.log(`✅ Bulk updated ${bulkOps.length} products`);
    } else {
      console.log("ℹ️ No products needed updating");
    }

    console.log("\n📊 Summary:");
    console.log(`Total products: ${total}`);
    console.log(`Updated: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
