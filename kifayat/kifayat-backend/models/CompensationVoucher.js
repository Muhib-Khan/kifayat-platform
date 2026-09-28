const mongoose = require("mongoose");

const compensationVoucherSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cancelOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CancelOrder",
      required: true,
    },
    voucher_type: {
      type: String,
      enum: ["discount_all", "discount_specific", "free_product"],
      required: true,
    },
    discount_percent: {
      type: Number,
      min: 1,
      max: 100,
      default: null,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    generated_at: { type: Date, default: Date.now },
    used: { type: Boolean, default: false },
    used_at: { type: Date, default: null },
    expires_at: { type: Date, required: true },
    used_on_order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { collection: "compensation_vouchers" }
);

compensationVoucherSchema.index({ user: 1, generated_at: -1 });
compensationVoucherSchema.index({ used: 1, expires_at: 1 });

module.exports = mongoose.model("CompensationVoucher", compensationVoucherSchema);
