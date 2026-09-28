const mongoose = require("mongoose");

const orderHistorySchema = new mongoose.Schema(
  {
    orderID: { type: String, required: true },
    // Stable original order id (pre KO-rewrite) — the archive's dedup key.
    // The unique sparse index below makes double-download inserts fail loudly
    // instead of silently duplicating archives + loyalty points.
    sourceOrderID: { type: String, default: "" },
    name: { type: String, required: true },
    address: { type: String, required: true },
    shpType: { type: String, required: true },
    courierCompany: { type: String, required: true },
    courierCity: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    phoneNumber2: { type: String, default: "" },
    sellPrice: { type: Number, required: true },
    businessProfiles: { type: Number, default: 1 },
    courierInstruction: { type: String, default: "" },
    productCount: { type: Number, default: 0 },
    productSearch: { type: [String], default: [] },
    shipping: { type: String, required: true },
    allowToOpen: { type: String, default: "" },
    confirmationToken: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    exportedAt: { type: Date, default: Date.now },
    // Order Status Management — set by the admin from the "Order Status"
    // panel after the order was exported to the main order CSV; surfaced to
    // the customer on the "Your Orders" page with realtime status updates.
    trackingStatus: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    trackingStatusUpdatedAt: { type: Date, default: null },
    // Customer-facing stock alerts — set when an item in this order went out
    // of stock (deleted from the catalog). The order itself is unaffected.
    stockAlerts: {
      type: [
        {
          productId: { type: String, default: "" },
          productName: { type: String, default: "" },
          sku: { type: String, default: "" },
          notifiedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "OrderHistory",
    strict: false,
  },
);

orderHistorySchema.index({ "user.userId": 1 }, { sparse: true });
orderHistorySchema.index({ sourceOrderID: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("OrderHistory", orderHistorySchema);
