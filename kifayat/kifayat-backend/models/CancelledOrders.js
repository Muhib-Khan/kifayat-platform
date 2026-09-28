const mongoose = require("mongoose");

const cancelledOrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: { type: String, default: "" },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  imageUrl: { type: String, default: "" },
}, { _id: false });

const cancelledOrdersSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    originalConfirmationGapId: { type: mongoose.Schema.Types.ObjectId, ref: "ConfirmationGap" },
    confirmationToken: { type: String, default: "" },
    items: [cancelledOrderItemSchema],
    totalAmount: { type: Number, default: 0 },
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
    confirmed: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: Date.now },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true, collection: "CancelledOrders" }
);

cancelledOrdersSchema.index({ user: 1, createdAt: -1 });
cancelledOrdersSchema.index({ cancelledAt: -1 });

module.exports = mongoose.model("CancelledOrders", cancelledOrdersSchema);
