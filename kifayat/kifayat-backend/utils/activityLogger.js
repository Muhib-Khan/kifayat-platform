const ActivityLog = require("../models/ActivityLog");

/**
 * Log an activity
 * @param {Object} options
 * @param {Object} [options.user] - The actor user object (req.user). Can be null for system actions.
 * @param {string} options.action - Action type (LOGIN, PROFILE_UPDATED, etc.)
 * @param {string} options.description - Human-readable description
 * @param {Object} [options.req] - Express request object (optional, for IP and user agent)
 * @param {Object} [options.metadata] - Additional data (optional)
 * @param {ObjectId} [options.targetUser] - The user who was affected (optional)
 */
const logActivity = async ({ user, action, description, req = null, metadata = {}, targetUser = null }) => {
  try {
    const logData = {
      action,
      description,
      metadata,
      targetUser: targetUser || undefined,
    };

    if (user) {
      logData.admin = user._id;
      logData.adminName = user.name || "Unknown";
      logData.adminEmail = user.email || "Unknown";
    }

    // Extract IP and user agent from request if available
    if (req) {
      logData.ipAddress = req.ip || req.connection?.remoteAddress || "";
      logData.userAgent = req.get("User-Agent") || "";
    }

    await ActivityLog.create(logData);
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging shouldn't break the main operation
  }
};

// Action types for consistency
const ACTIONS = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  USER_DELETED: "USER_DELETED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  PRODUCT_ADDED: "PRODUCT_ADDED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  PRODUCT_DELETED: "PRODUCT_DELETED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  ACTIVITY_LOGS_VIEWED: "ACTIVITY_LOGS_VIEWED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  EMAIL_CHANGED: "EMAIL_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  ORDER_CON_EMAIL_CHANGED: "ORDER_CON_EMAIL_CHANGED",
  ACCOUNT_DELETED: "ACCOUNT_DELETED",
  USER_BLOCKED: "USER_BLOCKED",
};

module.exports = { logActivity, ACTIONS };
