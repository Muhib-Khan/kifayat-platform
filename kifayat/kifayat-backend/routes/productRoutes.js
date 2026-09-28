const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sniffUpload } = require("../utils/fileSniffer");
const {
  uploadCSV,
  uploadProductFiles,
  getProducts,
  getSuggestions,
  getTrendingSearches,
  getAdminProducts,
  getLeaderboard,
  getReport,
  getStats,
  clearProducts,
  createManualProduct,
  getProductById,
  getSimilarProducts,
  updateStock,
  updateProduct,
  deleteProduct,
  getDeletedProducts,
  restoreProduct,
  updatePricingByCategory,
  updatePricingAll,
  getOutOfStockProducts,
  getCategoryPricing,
  getCategories,
  updateCategoryImage,
  getAllReports,
  getProductOrders,
  recategorizeAll,
  recategorizeAllKeywords,
  getRecategorizeStatus,
  getFeaturedLanding,
  toggleFeaturedLanding,
  getFeaturedCount,
  setFeaturedOrder,
  updateProductManualPosition,
  updateBulkManualPositions,
  clearAllManualPositions,
} = require("../controllers/productController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");

const router = express.Router();

// ── Public storefront routes (must come before /:id to avoid param capture) ──
router.get("/", getProducts);
router.get("/suggest", getSuggestions);
router.get("/trending-searches", getTrendingSearches);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    // Accept CSV by mimetype or .csv extension
    const ok =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv");
    ok ? cb(null, true) : cb(new Error("Only .csv files are allowed."));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Product image/video uploads (admin only) ──────────────────────────────
// Files are stored on disk (not memory) because images/videos can be large.
// Each file's on-disk extension is derived from its real magic bytes via fileSniffer,
// never from the client-supplied filename — preventing stored-XSS via polyglots.
const productsUploadDir = path.join(__dirname, "..", "uploads", "products");
if (!fs.existsSync(productsUploadDir)) {
  fs.mkdirSync(productsUploadDir, { recursive: true });
}

const productFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productsUploadDir),
    filename: (_req, _file, cb) => {
      cb(null, `prod-${Date.now()}-${Math.round(Math.random() * 1e9)}`);
    },
  }),
  fileFilter: (_req, _file, cb) => cb(null, true), // byte-level validation happens in the handler
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

// CSV upload — validate content from magic bytes, reject binaries/polyglots
router.post(
  "/upload-csv",
  protect,
  requireAdmin,
  requireSameOrigin,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

      // Sniff the file from the buffer; for CSV allowlist we use isTextCsv
      const sniffed = sniffUpload({ buffer: req.file.buffer }, "csv");
      if (!sniffed) {
        return res.status(400).json({ success: false, message: "Invalid CSV file." });
      }

      next();
    } catch (err) {
      console.error("CSV upload validation error:", err);
      return res.status(500).json({ success: false, message: "CSV upload failed." });
    }
  },
  upload.single("csv"),
   uploadCSV
);

// Product image/video uploads — accepts multiple images and one video from
// the admin product edit form's "Upload from Gallery" buttons.
router.post(
  "/upload-files",
  protect,
  requireAdmin,
  requireSameOrigin,
  productFileUpload.fields([
    { name: "images", maxCount: 20 },
    { name: "video", maxCount: 1 },
  ]),
  uploadProductFiles
);

// ── Product CRUD (admin) ──
router.get("/admin-list", protect, requireAdmin, getAdminProducts);
router.get("/stats", protect, requireAdmin, getStats);
router.get("/leaderboard", protect, requireAdmin, getLeaderboard);
router.get("/out-of-stock", protect, requireAdmin, getOutOfStockProducts);
router.get("/category-pricing", protect, requireAdmin, getCategoryPricing);
router.get("/categories", getCategories);
router.get("/featured-landing", getFeaturedLanding);
router.get("/featured-count", protect, requireAdmin, getFeaturedCount);
router.post("/manual", protect, requireAdmin, requireSameOrigin, createManualProduct);
router.post("/recategorize-all", protect, requireAdmin, requireSameOrigin, recategorizeAll);
router.post("/recategorize-all-keywords", protect, requireAdmin, requireSameOrigin, recategorizeAllKeywords);
router.get("/recategorize-status", protect, requireAdmin, getRecategorizeStatus);
router.post("/update-pricing-all", protect, requireAdmin, requireSameOrigin, updatePricingAll);
router.post("/update-pricing-by-category", protect, requireAdmin, requireSameOrigin, updatePricingByCategory);
router.put("/featured-order", protect, requireAdmin, requireSameOrigin, setFeaturedOrder);
router.put("/manual-positions/bulk", protect, requireAdmin, requireSameOrigin, updateBulkManualPositions);
router.delete("/manual-positions", protect, requireAdmin, requireSameOrigin, clearAllManualPositions);
router.get("/deleted", protect, requireAdmin, getDeletedProducts);
router.patch("/:id/restore", protect, requireAdmin, requireSameOrigin, restoreProduct);

// ── Single product (admin) ──
router.get("/:id", getProductById);
router.put("/:id", protect, requireAdmin, requireSameOrigin, updateProduct);
router.delete("/:id", protect, requireAdmin, requireSameOrigin, deleteProduct);
router.patch("/:id/stock", protect, requireAdmin, requireSameOrigin, updateStock);
router.put("/:id/featured-landing", protect, requireAdmin, requireSameOrigin, toggleFeaturedLanding);
router.patch("/:id/manual-position", protect, requireAdmin, requireSameOrigin, updateProductManualPosition);
router.get("/:id/similar", getSimilarProducts);
router.get("/:id/orders", protect, requireAdmin, getProductOrders);

module.exports = router;
