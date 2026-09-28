const mongoose = require("mongoose");

const productReceiptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderHistory" },
    orderId: { type: String, required: true },
    items: [
      {
        name: { type: String, default: "" },
        price: { type: Number, default: 0 },
        quantity: { type: Number, default: 1 },
        imageUrl: { type: String, default: "" },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    image: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: "" },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productReceiptSchema.index({ user: 1, orderId: 1 });
productReceiptSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ProductReceipt", productReceiptSchema);
