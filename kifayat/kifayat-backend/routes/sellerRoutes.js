const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  listSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  getStorefront,
  getSellerAnalytics,
  getSellerMonitoring,
} = require("../controllers/sellerController");
const { uploadProductFiles } = require("../controllers/productController");
const { requireSeller } = require("../middleware/sellerProtect");
const requireSameOrigin = require("../middleware/originGuard");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

// ── Seller image/video uploads ──────────────────────────────────────
// Reuses the same controller + magic-byte sniffing as the admin endpoint;
// sellers upload to the same uploads/products/ directory but through a
// separate route gated by requireSeller (not requireAdmin).
const productsUploadDir = path.join(__dirname, "..", "uploads", "products");
if (!fs.existsSync(productsUploadDir)) {
  fs.mkdirSync(productsUploadDir, { recursive: true });
}

const sellerFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productsUploadDir),
    filename: (_req, _file, cb) =>
      cb(null, `prod-${Date.now()}-${Math.round(Math.random() * 1e9)}`),
  }),
  fileFilter: (_req, _file, cb) => cb(null, true),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post(
  "/upload-files",
  requireSeller,
  requireSameOrigin,
  sellerFileUpload.fields([
    { name: "images", maxCount: 20 },
    { name: "video", maxCount: 1 },
  ]),
  uploadProductFiles,
);

router.get("/products", requireSeller, listSellerProducts);
router.get("/analytics", requireSeller, getSellerAnalytics);
router.post("/products", requireSeller, requireSameOrigin, createSellerProduct);
router.put("/products/:id", requireSeller, requireSameOrigin, updateSellerProduct);
router.delete("/products/:id", requireSeller, requireSameOrigin, deleteSellerProduct);
router.get("/monitoring", protect, requireAdmin, getSellerMonitoring);
router.get("/:slug", getStorefront);

module.exports = router;