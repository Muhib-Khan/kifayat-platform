const mongoose = require("mongoose");

const mainOrderCSVDataSchema = new mongoose.Schema(
  {
    orderID: { type: String, required: true },
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
    exported: { type: Boolean, default: false },
    confirmationToken: { type: String, default: "" },
    hhcStatus: { type: String, enum: ["pending", "assigned"], default: "pending" },
    hhcAssignedAt: { type: Date, default: null },
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
    collection: "MainOrderCSVData",
    strict: false,
  },
);

mainOrderCSVDataSchema.index({ orderID: 1 }, { unique: true });
mainOrderCSVDataSchema.index({ exported: 1 });

module.exports = mongoose.model("MainOrderCSVData", mainOrderCSVDataSchema);
