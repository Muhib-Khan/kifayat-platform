const express = require("express");
const multer = require("multer");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const {
  submitReceipt,
  getMyReceipts,
  getAdminReceipts,
  approveReceipt,
  rejectReceipt,
} = require("../controllers/receiptController");

const router = express.Router();

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Only images (JPEG, PNG, WebP, GIF) are allowed."));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── User routes ──
router.post("/", protect, receiptUpload.single("image"), submitReceipt);
router.get("/mine", protect, getMyReceipts);

// ── Admin routes ──
router.get("/admin", protect, requireAdmin, getAdminReceipts);
router.patch("/:id/approve", protect, requireAdmin, approveReceipt);
router.patch("/:id/reject", protect, requireAdmin, rejectReceipt);

module.exports = router;
