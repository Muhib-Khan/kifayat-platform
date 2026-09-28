const mongoose = require("mongoose");

const preOrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: { type: String, default: "" },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  imageUrl: { type: String, default: "" },
  // Selected product variation (label) chosen at checkout — surfaced in the
  // CSV workflow via the variation${i} column.
  variation: { type: String, default: "" },
  // Resolved HHC ids — the real HHC Variation ID and HHC Product ID captured
  // when the order is confirmed/finalized, so nothing is lost before the
  // Main Order CSV (HHC Bulk Order format) is generated.
  variationId: { type: String, default: "" },
  productId: { type: String, default: "" },
}, { _id: false });

const preOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    items: [preOrderItemSchema],
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    name: { type: String, default: "" },
    address: { type: String, default: "" },
    shpType: { type: String, default: "Regular" },
    courierCompany: { type: String, default: "" },
    courierCity: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    phoneNumber2: { type: String, default: "" },
    sellPrice: { type: Number, default: 0 },
    businessProfiles: { type: Number, default: 1 },
    courierInstruction: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true },
    shipping: { type: String, default: "cod" },
    allowToOpen: { type: String, default: "" },
    finalized: { type: Boolean, default: false },
    confirmationToken: { type: String, default: "" },
    confirmationExpiresAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { timestamps: true, collection: "pre_orders" }
);

preOrderSchema.index({ user: 1, createdAt: -1 });
// A confirmed order may be processed by the confirmation callback and an
// admin retry at nearly the same time. Keep one canonical PreOrder per order.
preOrderSchema.index({ order: 1 }, { unique: true, sparse: true });
preOrderSchema.index({ email: 1 });
preOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PreOrder", preOrderSchema);
