const mongoose = require("mongoose");

const websiteReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    response: { type: String, default: "" },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "website_reviews" }
);

websiteReviewSchema.index({ pinned: -1, createdAt: -1 });

module.exports = mongoose.model("WebsiteReview", websiteReviewSchema);
