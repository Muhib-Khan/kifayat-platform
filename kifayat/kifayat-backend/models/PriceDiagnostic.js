const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, default: "" },
    productSku: { type: String, default: "" },
    wholesalePrice: { type: Number, default: 0 },
    retailPrice: { type: Number, default: 0 },
    category: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "fixed", "skipped"],
      default: "pending",
    },
  },
  { _id: false }
);

const priceDiagnosticSchema = new mongoose.Schema(
  {
    runAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "acknowledged", "resolved", "auto_applied"],
      default: "pending",
    },
    confirmToken: { type: String, default: "" },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String, default: "" },
    acknowledgedAt: { type: Date, default: null },
    issues: [issueSchema],
    fixedCount: { type: Number, default: 0 },
    autoApplied: { type: Boolean, default: false },
    autoAppliedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    triggeredBy: { type: String, default: "auto" },
  },
  { timestamps: true, collection: "price_diagnostics" }
);

module.exports = mongoose.model("PriceDiagnostic", priceDiagnosticSchema);
