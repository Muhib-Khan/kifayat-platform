const express = require("express");
const {
  listSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  getStorefront,
  getSellerAnalytics,
  getSellerMonitoring,
} = require("../controllers/sellerController");
const { requireSeller } = require("../middleware/sellerProtect");
const requireSameOrigin = require("../middleware/originGuard");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

router.get("/products", requireSeller, listSellerProducts);
router.get("/analytics", requireSeller, getSellerAnalytics);
router.post("/products", requireSeller, requireSameOrigin, createSellerProduct);
router.put("/products/:id", requireSeller, requireSameOrigin, updateSellerProduct);
router.delete("/products/:id", requireSeller, requireSameOrigin, deleteSellerProduct);
router.get("/monitoring", protect, requireAdmin, getSellerMonitoring);
router.get("/:slug", getStorefront);

module.exports = router;