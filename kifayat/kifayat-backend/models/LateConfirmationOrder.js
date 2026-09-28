const mongoose = require("mongoose");

const lateConfirmationItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: { type: String, default: "" },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  imageUrl: { type: String, default: "" },
}, { _id: false });

const lateConfirmationOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    originalPreOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PreOrder" },
    items: [lateConfirmationItemSchema],
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
    notifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "late_confirmation_orders" }
);

lateConfirmationOrderSchema.index({ user: 1, createdAt: -1 });
lateConfirmationOrderSchema.index({ email: 1 });

module.exports = mongoose.model("LateConfirmationOrder", lateConfirmationOrderSchema);
