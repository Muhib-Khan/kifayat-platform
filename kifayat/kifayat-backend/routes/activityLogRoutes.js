const express = require("express");
const { getActivityLogs, getActivityStats } = require("../controllers/activityLogController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

// All routes require authentication + admin role
router.use(protect, requireAdmin);

router.get("/", getActivityLogs);
router.get("/stats", getActivityStats);

module.exports = router;
