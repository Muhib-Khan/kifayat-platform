const mongoose = require("mongoose");

const dynamicDataSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productId: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    // Extracted from the HHC dynamic API response (multiple images / variations)
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    variations: { type: mongoose.Schema.Types.Mixed, default: [] },
    // Ordered media: [{ id, url, type: image|video }]
    gallery: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, collection: "dynamicdata" },
);

dynamicDataSchema.index({ product: 1 });
dynamicDataSchema.index({ productId: 1 });

module.exports = mongoose.model("DynamicData", dynamicDataSchema);
