const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");
const {
  getMainOrderStatusList,
  updateTrackingStatus,
} = require("../controllers/orderTrackingController");

router.use(protect, requireAdmin, requireSameOrigin);

router.get("/", getMainOrderStatusList);
router.patch("/:id", updateTrackingStatus);

module.exports = router;