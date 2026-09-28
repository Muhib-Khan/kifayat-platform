const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: { type: String, default: "", trim: true },
    sku: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    wholesalePrice: { type: Number, default: 0, min: 0 },
    retailPrice: { type: Number, default: 0, min: 0 },
    // Persisted exemption: low-price products get flat +270 and never a % margin
    lowPrice: { type: Boolean, default: false },
    stock: { type: Number, default: 0, min: 0 },
    originalStock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: "Uncategorized", trim: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // SEO — filled by the admin edit form and the AI "SEO Booster"; routed to
    // site search and the product page's meta/JSON-LD.
    keywords: { type: [String], default: [] },
    seoTitle: { type: String, default: "", trim: true },
    seoDescription: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true },
    videoUrl: { type: String, default: "", trim: true },
    hidden: { type: Boolean, default: false },
    weight: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0 },
    uploadBatch: { type: String, default: "" },
    stockOutAt: { type: Date, default: null },
    pendingDeleteAt: { type: Date, default: null },
    page: { type: Number, default: null },
    newProduct: { type: Boolean, default: null },
    featuredOnLanding: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: null },
    manualPosition: { type: Number, default: null },
    rawData: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Filled by the "Get Product Dynamic Data" admin action (HHC dynamic API)
    variations: { type: mongoose.Schema.Types.Mixed, default: [] },
    // Ordered media from the HHC dynamic API: [{ id, url, type: image|video }]
    gallery: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Soft-delete: when true the product is hidden from storefront + admin list
    // but preserved in the database for the "Deleted Products" admin page.
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "products" },
);

productSchema.index({ category: 1 });
productSchema.index({ seller: 1, deleted: 1, hidden: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ stockOutAt: 1 });
productSchema.index({ pendingDeleteAt: 1 });
productSchema.index({ wholesalePrice: 1 });
productSchema.index({ name: "text", description: "text", sku: "text", productId: "text", keywords: "text" });
// Query/scan indexes for the public catalogue — cover the filters and sorts
// used by getProducts / getFeaturedLanding so scans & in-memory sorts are avoided.
productSchema.index({ hidden: 1, createdAt: -1 });
productSchema.index({ hidden: 1, salesCount: -1 });
productSchema.index({ hidden: 1, category: 1 });
productSchema.index({ retailPrice: 1 });
productSchema.index({ featuredOnLanding: 1, updatedAt: -1 });
productSchema.index({ manualPosition: 1 });
productSchema.index({ page: 1, createdAt: -1 });
productSchema.index({ slug: 1 });
productSchema.index({ deleted: 1, deletedAt: -1 });

// Remove sensitive wholesale price before sending to users
productSchema.methods.toPublicObject = function () {
  const obj = this.toObject();
  delete obj.wholesalePrice;
  delete obj.uploadBatch;
  delete obj.__v;
  obj.lowPrice = this.lowPrice === true;
  return obj;
};

module.exports = mongoose.model("Product", productSchema);
