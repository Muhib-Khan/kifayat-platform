const mongoose = require("mongoose");

const blockedUserSchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    gender: { type: String, default: "" },
    phone: { type: String, default: "" },
    authProvider: { type: String, default: "" },
    firebaseUID: { type: String, default: "" },
    role: { type: String, default: "user" },
    isVerified: { type: Boolean, default: false },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: { type: String, default: "" },
    loyaltyPoints: { type: Number, default: 0 },
    tier: { type: String, enum: ["bronze", "silver", "gold", "platinum"], default: "bronze" },
    tierAssignedManually: { type: Boolean, default: false },
    customDiscountPercent: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "blocked_users" },
);

module.exports = mongoose.model("BlockedUser", blockedUserSchema);
