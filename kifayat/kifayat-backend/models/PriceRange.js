const mongoose = require("mongoose");
const priceRangeSchema = new mongoose.Schema(
  {
    minPrice:    { type: Number, required: true, min: 0 },
    maxPrice:    { type: Number, required: true, min: 0 },
    profitMargin:{ type: Number, required: true, min: 0, max: 10000 },
  },
  { timestamps: true, collection: "price ranges profit margin" }
);
module.exports = mongoose.model("PriceRange", priceRangeSchema);
