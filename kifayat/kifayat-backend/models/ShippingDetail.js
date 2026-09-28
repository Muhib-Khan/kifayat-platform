const mongoose = require("mongoose");

const shippingDetailSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    shpType: {
      type: String,
      enum: ["Regular", "Bulky"],
      required: true,
      default: "Regular",
    },
    courierCompany: { type: String, required: true, trim: true },
    courierCity: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    phoneNumber2: { type: String, default: "", trim: true },
    sellPrice: { type: Number, required: true, min: 0 },
    businessProfiles: { type: Number, default: 1 },
    courierInstruction: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    shipping: {
      type: String,
      enum: ["cod", "ap"],
      required: true,
      default: "cod",
    },
    allowToOpen: { type: String, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { timestamps: true, collection: "shipping_details" },
);

shippingDetailSchema.index({ user: 1 });
shippingDetailSchema.index({ order: 1 });

module.exports = mongoose.model("ShippingDetail", shippingDetailSchema);
