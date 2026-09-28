const mongoose = require("mongoose");

const trendingSearchSchema = new mongoose.Schema(
  {
    term: { type: String, required: true, unique: true, lowercase: true, trim: true },
    count: { type: Number, default: 0, min: 0 },
    lastSearchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "trendingsearches" },
);

// Trending list reads sort by count desc — keep an index for it.
trendingSearchSchema.index({ count: -1 });

module.exports = mongoose.model("TrendingSearch", trendingSearchSchema);