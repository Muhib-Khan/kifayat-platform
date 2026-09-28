const ActivityLog = require("../models/ActivityLog");
const { logActivity, ACTIONS } = require("../utils/activityLogger");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/activity-logs  (admin — get all activity logs)
// Query params: page, limit, action (filter by action type)
// ─────────────────────────────────────────────────────────────────────────────
const getActivityLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actionFilter = req.query.action;

    const query = {};
    if (actionFilter && actionFilter !== "all") {
      query.action = actionFilter;
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    // Log that admin viewed activity logs
    await logActivity({
      user: req.user,
      action: ACTIONS.ACTIVITY_LOGS_VIEWED,
      description: `Viewed activity logs (page ${page})`,
      req,
    });

    return res.status(200).json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getActivityLogs error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch activity logs." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/activity-logs/stats  (admin — get activity statistics)
// ─────────────────────────────────────────────────────────────────────────────
const getActivityStats = async (req, res) => {
  try {
    const stats = await ActivityLog.aggregate([
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          lastActivity: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await ActivityLog.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    return res.status(200).json({
      success: true,
      stats,
      recentActivity,
    });
  } catch (err) {
    console.error("getActivityStats error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
};

module.exports = { getActivityLogs, getActivityStats };
