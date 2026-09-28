const User = require("../models/User");
const Session = require("../models/Session");
const LoginHistory = require("../models/LoginHistory");
const ActivityLog = require("../models/ActivityLog");
const DeletedUser = require("../models/DeletedUser");
const BlockedUser = require("../models/BlockedUser");
const OrderHistory = require("../models/OrderHistory");
const { escapeRegex } = require("../utils/safeRegex");
const { logActivity, ACTIONS } = require("../utils/activityLogger");

const getUsers = async (req, res) => {
  try {
    const { q = "", page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (q.trim()) {
      const search = q.trim();
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -otp -otpExpiry -jwtToken -pendingEmailOTP -pendingEmailOTPExpiry -pendingPasswordOTP -pendingPasswordOTPExpiry -pendingOrderConEmailOTP -pendingOrderConEmailOTPExpiry -newPassword -pendingNewPassword")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Per-user stats from the DURABLE sales record — OrderHistory survives
    // order moves/cancellations, unlike the daily Order collection.
    const ids = users.map((u) => u._id);
    const [orderStats, lastActiveDocs] = await Promise.all([
      ids.length
        ? OrderHistory.aggregate([
            { $match: { "user.userId": { $in: ids } } },
            {
              $group: {
                _id: "$user.userId",
                orderCount: { $sum: 1 },
                totalSpent: { $sum: { $ifNull: ["$sellPrice", 0] } },
              },
            },
          ])
        : [],
      ids.length
        ? Session.aggregate([
            { $match: { user: { $in: ids }, lastActiveAt: { $ne: null } } },
            { $sort: { lastActiveAt: -1 } },
            {
              $group: {
                _id: "$user",
                lastActiveAt: { $first: "$lastActiveAt" },
              },
            },
          ])
        : [],
    ]);
    const statsMap = new Map(orderStats.map((s) => [String(s._id), s]));
    const lastActiveMap = new Map(
      lastActiveDocs.map((s) => [String(s._id), s.lastActiveAt]),
    );
    const usersWithStats = users.map((u) => ({
      ...u,
      stats: {
        orderCount: statsMap.get(String(u._id))?.orderCount ?? 0,
        totalSpent: statsMap.get(String(u._id))?.totalSpent ?? 0,
      },
      lastActiveAt: lastActiveMap.get(String(u._id)) || null,
    }));

    // Blocked + deleted accounts are NOT in the users collection (they are
    // moved out on block/delete) — surface them here so admins can see and
    // unblock/restore them instead of ghosting out of the panel.
    const [blocked, deleted] = await Promise.all([
      BlockedUser.find({}).sort({ createdAt: -1 }).limit(50).lean(),
      DeletedUser.find({}).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    return res.status(200).json({
      success: true,
      users: usersWithStats,
      blocked,
      deleted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("Get users error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch users." });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name email role loyaltyPoints priceMultiplier tier createdAt"
    ).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("Get user by id error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch user." });
  }
};

const getUserLoginHistory = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("name email");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const history = await LoginHistory.find({ userId: user._id })
      .sort({ loginAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email },
      history,
    });
  } catch (err) {
    console.error("Login history error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch login history." });
  }
};

const deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account.",
      });
    }

    if (target.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot delete other admins.",
      });
    }

    const { message } = req.body;

    // Save to deleted_users collection before deleting
    await DeletedUser.create({
      originalId: target._id,
      name: target.name,
      email: target.email,
      gender: target.gender || "",
      phone: target.phone || "",
      authProvider: target.authProvider || "",
      firebaseUID: target.firebaseUID || "",
      role: target.role || "user",
      isVerified: target.isVerified || false,
      deletedBy: req.user._id,
      message: message || "",
    });

    if (target.firebaseUID) {
      try {
        await getAuth().deleteUser(target.firebaseUID);
      } catch (firebaseErr) {
        console.warn(
          "Firebase user delete skipped:",
          firebaseErr.code || firebaseErr.message
        );
      }
    }

    await LoginHistory.deleteMany({ userId: target._id });
    await User.deleteOne({ _id: target._id });

    // Log admin activity
    await logActivity({
      user: req.user,
      action: ACTIONS.USER_DELETED,
      description: `Deleted user "${target.email}" (${target.name})`,
      req,
      metadata: { deletedUserId: target._id, deletedEmail: target.email },
    });

    return res.status(200).json({
      success: true,
      message: `User "${target.email}" deleted successfully.`,
    });
  } catch (err) {
    console.error("Delete user error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete user." });
  }
};

const blockUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own admin account.",
      });
    }

    if (target.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot block other admins.",
      });
    }

    const { message } = req.body;

    // Check if already blocked
    const alreadyBlocked = await BlockedUser.findOne({ email: target.email });
    if (alreadyBlocked) {
      return res.status(400).json({
        success: false,
        message: "This user is already blocked.",
      });
    }

    await BlockedUser.create({
      originalId: target._id,
      name: target.name,
      email: target.email,
      gender: target.gender || "",
      phone: target.phone || "",
      authProvider: target.authProvider || "",
      firebaseUID: target.firebaseUID || "",
      role: target.role || "user",
      isVerified: target.isVerified || false,
      blockedBy: req.user._id,
      message: message || "",
      loyaltyPoints: target.loyaltyPoints || 0,
      tier: target.tier || "bronze",
      tierAssignedManually: target.tierAssignedManually || false,
      customDiscountPercent: target.customDiscountPercent || 0,
    });

    await User.deleteOne({ _id: target._id });
    await LoginHistory.deleteMany({ userId: target._id });

    await logActivity({
      user: req.user,
      action: ACTIONS.USER_BLOCKED || "USER_BLOCKED",
      description: `Blocked user "${target.email}" (${target.name})`,
      req,
      metadata: { blockedUserId: target._id, blockedEmail: target.email },
    });

    return res.status(200).json({
      success: true,
      message: `User "${target.email}" blocked.`,
    });
  } catch (err) {
    console.error("Block user error:", err);
    return res.status(500).json({ success: false, message: "Failed to block user." });
  }
};

// Unblock a user: removes the BlockedUser record AND restores the User
// account from the snapshot taken at block time (must re-verify — blocked
// accounts are closed and their docs were deleted).
const unblockUser = async (req, res) => {
  try {
    const blocked = await BlockedUser.findById(req.params.id);
    if (!blocked) {
      return res.status(404).json({ success: false, message: "Blocked user not found." });
    }

    await User.create({
      _id: blocked.originalId || undefined,
      name: blocked.name,
      email: blocked.email,
      gender: blocked.gender || "",
      phone: blocked.phone || "",
      authProvider: blocked.authProvider || "",
      firebaseUID: blocked.firebaseUID || "",
      role: "user",
      isVerified: false,
      tier: blocked.tier || "bronze",
      tierAssignedManually: blocked.tierAssignedManually || false,
      customDiscountPercent: blocked.customDiscountPercent || 0,
      loyaltyPoints: blocked.loyaltyPoints || 0,
    });

    await BlockedUser.deleteOne({ _id: blocked._id });

    await logActivity({
      user: req.user,
      action: ACTIONS.USER_UNBLOCKED || "USER_UNBLOCKED",
      description: `Unblocked user "${blocked.email}"`,
      req,
      metadata: { blockedUserId: blocked._id },
    });

    return res.status(200).json({
      success: true,
      message: `User "${blocked.email}" unblocked. They must verify their email again.`,
    });
  } catch (err) {
    console.error("Unblock user error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      });
    }
    return res.status(500).json({ success: false, message: "Failed to unblock user." });
  }
};

const getUserStatus = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    // Check blocked first
    const blocked = await BlockedUser.findOne({ email }).lean();
    if (blocked) {
      return res.status(200).json({
        success: true,
        status: "blocked",
        message: blocked.message || "Your account has been blocked.",
        email: blocked.email,
      });
    }

    // Check deleted
    const deleted = await DeletedUser.findOne({ email }).lean();
    if (deleted) {
      return res.status(200).json({
        success: true,
        status: "deleted",
        message: deleted.message || "Your account has been deleted.",
        email: deleted.email,
      });
    }

    return res.status(200).json({ success: true, status: "active" });
  } catch (err) {
    console.error("getUserStatus error:", err);
    return res.status(500).json({ success: false, message: "Failed to check account status." });
  }
};

const getUserActivity = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("name email");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { targetUser: user._id };

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email },
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("Get user activity error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch user activity." });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["name", "phone", "gender", "avatar", "dateOfBirth", "role", "isVerified", "isVerifiedCustomer"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update." });
    }

    // name cannot be null/empty — casting null used to blow up into a 500
    if ("name" in updates) {
      const name = String(updates.name ?? "").trim();
      if (!name) {
        return res.status(400).json({ success: false, message: "Name cannot be empty." });
      }
      updates.name = name;
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ success: false, message: "User not found." });

    // Admins cannot modify the role/verification of other admin accounts,
    // and an admin cannot change their own role (would lock the panel out).
    if (target.role === "admin" || String(target._id) === String(req.user._id)) {
      if ("role" in updates || "isVerified" in updates) {
        return res.status(403).json({
          success: false,
          message: "Admin account role and verification cannot be changed.",
        });
      }
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    await logActivity({
      user: req.user,
      action: ACTIONS.PROFILE_UPDATED || "PROFILE_UPDATED",
      description: `Admin updated profile for "${user.email}" (${user.name})`,
      req,
      targetUser: user._id,
    });
    return res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error("Update user profile error:", err);
    return res.status(500).json({ success: false, message: "Failed to update user." });
  }
};

const getUserTimeStats = async (req, res) => {
  try {
    const all = await Session.find({ user: req.params.id })
      .select("createdAt lastActiveAt loggedOutAt durationMs")
      .lean();

    if (!all.length) {
      return res.status(200).json({
        success: true,
        stats: {
          totalSessions: 0,
          completedSessions: 0,
          activeSessions: 0,
          totalDurationMs: 0,
          lastActiveAt: null,
        },
      });
    }

    const intervals = all.map((s) => ({
      start: s.createdAt.getTime(),
      end: s.loggedOutAt
        ? s.loggedOutAt.getTime()
        : s.lastActiveAt
          ? s.lastActiveAt.getTime()
          : Date.now(),
    }));

    // Sort by start and merge overlapping intervals
    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const iv of intervals) {
      if (merged.length && iv.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
      } else {
        merged.push({ ...iv });
      }
    }

    const totalDurationMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
    const completed = all.filter((s) => s.loggedOutAt);
    const active = all.filter((s) => !s.loggedOutAt);
    const lastActiveDoc = await Session.findOne({ user: req.params.id, lastActiveAt: { $ne: null } })
      .sort({ lastActiveAt: -1 })
      .select("lastActiveAt")
      .lean();

    return res.status(200).json({
      success: true,
      stats: {
        totalSessions: all.length,
        completedSessions: completed.length,
        activeSessions: active.length,
        totalDurationMs,
        lastActiveAt: lastActiveDoc?.lastActiveAt || null,
      },
    });
  } catch (err) {
    console.error("getUserTimeStats error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch time stats." });
  }
};

// ── Admin: Set user tier ────────────────────────────────────────────────────
const setUserTier = async (req, res) => {
  try {
    const { tier } = req.body;
    const valid = ["bronze", "silver", "gold", "platinum"];
    if (!valid.includes(tier)) {
      return res.status(400).json({ success: false, message: "Invalid tier." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    user.tier = tier;
    user.tierAssignedManually = true;
    await user.save();
    await logActivity(req.user._id, ACTIONS.ADMIN_ACTION, `Set user ${user.email} tier to ${tier}`);
    return res.json({ success: true, message: `User tier set to ${tier}.` });
  } catch (err) {
    console.error("setUserTier error:", err);
    return res.status(500).json({ success: false, message: "Failed to set tier." });
  }
};

// ── Admin: Set user discount ────────────────────────────────────────────────
const setUserDiscount = async (req, res) => {
  try {
    const { percent } = req.body;
    const pct = parseFloat(percent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ success: false, message: "Discount must be 0–100." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    user.customDiscountPercent = pct;
    await user.save();
    await logActivity(req.user._id, ACTIONS.ADMIN_ACTION, `Set user ${user.email} discount to ${pct}%`);
    return res.json({ success: true, message: `Discount set to ${pct}%.` });
  } catch (err) {
    console.error("setUserDiscount error:", err);
    return res.status(500).json({ success: false, message: "Failed to set discount." });
  }
};

// ── Admin: Reset tier to auto ────────────────────────────────────────────────
const resetUserTierAuto = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    user.tierAssignedManually = false;
    // Recalculate from the DURABLE sales record — the daily Order collection
    // is emptied as orders move into Main Order CSV, so counting Order docs
    // would silently downgrade every active customer back to bronze.
    const { getTier } = require("../config/tiers");
    const [orderCount, spent] = await Promise.all([
      OrderHistory.countDocuments({ "user.userId": user._id }),
      OrderHistory.aggregate([
        { $match: { "user.userId": user._id } },
        { $group: { _id: null, totalSpent: { $sum: { $ifNull: ["$sellPrice", 0] } } } },
      ]),
    ]);
    const totalSpent = spent[0]?.totalSpent ?? 0;
    user.totalOrdersCount = orderCount;
    user.totalSpentAmount = totalSpent;
    user.tier = getTier(orderCount, totalSpent);
    await user.save();
    await logActivity(req.user._id, ACTIONS.ADMIN_ACTION, `Reset tier auto for ${user.email} → ${user.tier}`);
    return res.json({ success: true, message: `Tier auto-assigned: ${user.tier}.` });
  } catch (err) {
    console.error("resetUserTierAuto error:", err);
    return res.status(500).json({ success: false, message: "Failed to reset tier." });
  }
};

// ── Admin: Set user loyalty points ──────────────────────────────────────────
const setUserLoyaltyPoints = async (req, res) => {
  try {
    const { points, reason } = req.body;
    const pts = parseInt(points);
    if (isNaN(pts) || pts < 0) {
      return res.status(400).json({ success: false, message: "Points must be a non-negative number." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const old = user.loyaltyPoints;
    user.loyaltyPoints = pts;
    await user.save();
    await logActivity(req.user._id, ACTIONS.ADMIN_ACTION, `Set ${user.email} loyalty points: ${old} → ${pts}${reason ? ` (${reason})` : ""}`);
    return res.json({ success: true, message: `Loyalty points set to ${pts}.`, loyaltyPoints: pts });
  } catch (err) {
    console.error("setUserLoyaltyPoints error:", err);
    return res.status(500).json({ success: false, message: "Failed to set loyalty points." });
  }
};

module.exports = {
  getUsers,
  getUserById, getUserLoginHistory, deleteUser, getUserActivity, blockUser, unblockUser, getUserStatus, updateUserProfile, getUserTimeStats, setUserTier, setUserDiscount, resetUserTierAuto, setUserLoyaltyPoints };
