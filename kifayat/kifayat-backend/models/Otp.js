const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    hashedOtp: { type: String, required: true },
    purpose: { type: String, required: true },
    expiry: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
