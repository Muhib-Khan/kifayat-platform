const mongoose = require("mongoose");

const userFinalDataSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    gender: { type: String, default: "" },
    authProvider: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    role: { type: String, default: "user" },
    joinedAt: { type: Date },
    lastActiveAt: { type: Date },
    orderConEmail: { type: String, default: "" },

    // Shipping info
    shippingName: { type: String, default: "" },
    shippingAddress: { type: String, default: "" },
    shippingPhone: { type: String, default: "" },
    shippingPhone2: { type: String, default: "" },
    shippingEmail: { type: String, default: "" },
    courierCity: { type: String, default: "" },
    courierCompany: { type: String, default: "" },

    // Order tracking
    totalOrders: { type: Number, default: 0 },
    totalProductsBought: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderDate: { type: Date },
  },
  { timestamps: true, collection: "users_final_data" }
);

userFinalDataSchema.index({ user: 1 });
userFinalDataSchema.index({ email: 1 });

module.exports = mongoose.model("UserFinalData", userFinalDataSchema);
