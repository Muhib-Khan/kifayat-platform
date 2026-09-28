const mongoose = require("mongoose");

const defectiveProductReportSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    product: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
      name: { type: String, default: "" },
      sku: { type: String, default: "" },
    },
    description: { type: String, default: "", trim: true },
    images: [{ type: String, trim: true }],
    videos: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "rejected"],
      default: "pending",
    },
    adminNote: { type: String, default: "", trim: true },
    chat: [
      {
        sender: {
          type: String,
          enum: ["user", "admin"],
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
        },
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true, collection: "defective_product_reports" }
);

defectiveProductReportSchema.index({ status: 1 });
defectiveProductReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model("DefectiveProductReport", defectiveProductReportSchema);
