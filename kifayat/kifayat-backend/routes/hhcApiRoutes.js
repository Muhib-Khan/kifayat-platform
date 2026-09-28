const express = require("express");
const {
  testToken,
  quickFetch,
  syncAll,
  getSyncStatus,
  stopSync,
  getHhcToken,
} = require("../controllers/hhcApiController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");
const {
  fetchProductDynamicData,
  syncDynamicAll,
  getDynamicSyncStatus,
  stopDynamicSync,
} = require("../controllers/dynamicDataController");

const router = express.Router();

router.post("/test-token", protect, requireAdmin, requireSameOrigin, testToken);
router.post("/quick-fetch", protect, requireAdmin, requireSameOrigin, quickFetch);
router.post("/sync-all", protect, requireAdmin, requireSameOrigin, syncAll);
router.get("/sync-status", protect, requireAdmin, getSyncStatus);
router.get("/status", protect, requireAdmin, getSyncStatus);
router.post("/sync-stop", protect, requireAdmin, requireSameOrigin, stopSync);
router.post("/stop", protect, requireAdmin, requireSameOrigin, stopSync);
router.post("/product-dynamic-data/:id", protect, requireAdmin, requireSameOrigin, fetchProductDynamicData);
router.post("/sync-dynamic-all", protect, requireAdmin, requireSameOrigin, syncDynamicAll);
router.get("/sync-dynamic-status", protect, requireAdmin, getDynamicSyncStatus);
router.post("/sync-dynamic-stop", protect, requireAdmin, requireSameOrigin, stopDynamicSync);
router.get("/token", protect, requireAdmin, getHhcToken);

module.exports = router;
