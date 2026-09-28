const mongoose = require("mongoose");

const discountVoucherSchema = new mongoose.Schema(
  {
    voucher_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discount_percent: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    points_required: {
      type: Number,
      required: true,
      min: 0,
    },
    purchased_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    purchased_at: {
      type: Date,
      default: null,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expires_at: {
      type: Date,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    max_uses: {
      type: Number,
      default: null,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "discount_vouchers" }
);

discountVoucherSchema.index({ is_active: 1, created_at: -1 });

module.exports = mongoose.model("DiscountVoucher", discountVoucherSchema);
