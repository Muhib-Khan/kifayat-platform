const PriceRange = require("../models/PriceRange");
const Product = require("../models/Product");
const { scheduleReprice } = require("../utils/pricing");

const MAX_PRICE = 1e9;

exports.getPriceRanges = async (req, res) => {
  const priceRanges = await PriceRange.find().sort({ createdAt: 1 });
  return res.json({ success: true, priceRanges });
};

exports.createPriceRange = async (req, res) => {
  const { minPrice, maxPrice, profitMargin } = req.body || {};
  const min = Number(minPrice);
  const max = Number(maxPrice);
  const pct = Number(profitMargin);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(pct)) {
    return res.status(400).json({ success: false, message: "minPrice, maxPrice and profitMargin must be numbers" });
  }
  if (min < 0 || max < 0 || max <= min) {
    return res.status(400).json({ success: false, message: "maxPrice must be greater than minPrice and both must be >= 0" });
  }
  if (pct < 0) {
    return res.status(400).json({ success: false, message: "profitMargin must be >= 0" });
  }
  if (pct > 10000) return res.status(400).json({ success: false, message: "profitMargin must be <= 10000" });
  if (min > MAX_PRICE || max > MAX_PRICE) {
    return res.status(400).json({ success: false, message: "Price bounds must not exceed 1,000,000,000" });
  }
  // Reject ranges that overlap an existing range. Ranges [a,b] and [c,d] overlap when a <= d && c <= b.
  const existingRanges = await PriceRange.find().lean();
  const conflicting = existingRanges.find((r) => min <= r.maxPrice && r.minPrice <= max);
  if (conflicting) {
    return res.status(400).json({
      success: false,
      message: `This price range overlaps an existing range (${conflicting.minPrice}-${conflicting.maxPrice}). Remove or adjust the conflicting range first.`,
    });
  }
  const priceRange = await PriceRange.create({ minPrice: min, maxPrice: max, profitMargin: pct });
  scheduleReprice();
  return res.status(201).json({ success: true, priceRange });
};

exports.deletePriceRange = async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const removed = await PriceRange.findByIdAndDelete(id);
  if (!removed) return res.status(404).json({ success: false, message: "Price range not found" });
  scheduleReprice();
  return res.json({ success: true });
};

exports.getPriceRangeProducts = async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const range = await PriceRange.findById(id);
  if (!range) return res.status(404).json({ success: false, message: "Price range not found" });
  const match = { wholesalePrice: { $gte: range.minPrice, $lte: range.maxPrice } };
  const [products, count] = await Promise.all([
    Product.find(match)
      .select("_id name imageUrl wholesalePrice retailPrice lowPrice category")
      .sort({ wholesalePrice: 1 })
      .limit(200),
    Product.countDocuments(match),
  ]);
  return res.json({ success: true, count, products });
};
