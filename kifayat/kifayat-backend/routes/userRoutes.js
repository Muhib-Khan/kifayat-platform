const express = require("express");
const {
  getUsers,
  getUserById,
  getUserLoginHistory,
  deleteUser,
  getUserActivity,
  blockUser,
  unblockUser,
  getUserStatus,
  updateUserProfile,
  getUserTimeStats,
  setUserTier,
  setUserDiscount,
  resetUserTierAuto,
  setUserLoyaltyPoints,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

router.get("/status", protect, getUserStatus);

router.use(protect, requireAdmin);

router.get("/", getUsers);
router.get("/:id", getUserById);
router.get("/:id/activity", getUserActivity);
router.get("/:id/login-history", getUserLoginHistory);
router.get("/:id/time-stats", getUserTimeStats);
router.put("/:id/profile", updateUserProfile);
router.delete("/:id", deleteUser);
router.post("/:id/block", blockUser);
router.post("/:id/unblock", unblockUser);
router.patch("/:id/tier", setUserTier);
router.patch("/:id/discount", setUserDiscount);
router.patch("/:id/loyalty-points", setUserLoyaltyPoints);
router.post("/:id/reset-tier", resetUserTierAuto);

module.exports = router;
