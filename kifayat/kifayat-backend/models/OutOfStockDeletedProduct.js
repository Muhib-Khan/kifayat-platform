const mongoose = require("mongoose");

const outOfStockDeletedProductSchema = new mongoose.Schema(
  {
    originalProductId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productId: { type: String, default: "", trim: true },
    sku: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    wholesalePrice: { type: Number, default: 0, min: 0 },
    retailPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    originalStock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: "Uncategorized", trim: true },
    imageUrl: { type: String, default: "", trim: true },
    videoUrl: { type: String, default: "", trim: true },
    weight: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0 },
    uploadBatch: { type: String, default: "" },
    deletedAt: { type: Date, default: Date.now },
    deletedBecause: { type: String, default: "out_of_stock" },
  },
  { timestamps: true, collection: "out_of_stock_deleted_products" },
);

module.exports = mongoose.model("OutOfStockDeletedProduct", outOfStockDeletedProductSchema);
