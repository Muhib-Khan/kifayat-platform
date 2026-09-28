const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminName: { type: String, default: "" },
    adminEmail: { type: String, default: "" },
    action: { 
      type: String, 
      required: true,
      enum: [
        "LOGIN",
        "LOGOUT",
        "USER_DELETED",
        "USER_ROLE_CHANGED",
        "ORDER_STATUS_CHANGED",
        "PRODUCT_ADDED",
        "PRODUCT_UPDATED",
        "PRODUCT_DELETED",
        "SETTINGS_UPDATED",
        "ACTIVITY_LOGS_VIEWED",
        "PROFILE_UPDATED",
        "EMAIL_CHANGED",
        "PASSWORD_CHANGED",
        "ORDER_CON_EMAIL_CHANGED",
        "ACCOUNT_DELETED",
      ]
    },
    description: { type: String, required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "activity_logs" }
);

// Index for faster queries
activityLogSchema.index({ admin: 1, createdAt: -1 });
activityLogSchema.index({ targetUser: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
