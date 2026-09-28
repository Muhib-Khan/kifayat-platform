const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sniffUpload } = require("../utils/fileSniffer");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");
const optionalAuth = require("../middleware/optionalAuth");
const { submitReport, getReports, getReportById, updateReportStatus, sendChatMessage, getChatMessages } = require("../controllers/defectiveProductController");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "uploads", "defective");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    // Use a safe filename based on timestamp+random, NOT the client-supplied extension.
    // The actual extension will be derived from the file's real magic bytes via fileSniffer.
    cb(null, `defective-${Date.now()}-${Math.round(Math.random() * 1e9)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  // Accept broad types client-side; byte-level validation is done in the upload handler.
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.post(
  "/",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 3 },
  ]),
  optionalAuth,
  async (req, res, next) => {
    try {
      // --- Validate image uploads ---
      if (req.files.images) {
        for (const f of req.files.images) {
          const sniffed = sniffUpload({ path: f.path, allowlist: "image" });
          if (!sniffed) {
            // Delete invalid file and reject
            fs.unlinkSync(f.path);
            return res.status(400).json({ success: false, message: `Invalid image file: ${f.filename}` });
          }
        }
      }
      // --- Validate video uploads ---
      if (req.files.videos) {
        for (const f of req.files.videos) {
          const sniffed = sniffUpload({ path: f.path, allowlist: "video" });
          if (!sniffed) {
            fs.unlinkSync(f.path);
            return res.status(400).json({ success: false, message: `Invalid video file: ${f.filename}` });
          }
        }
      }
      next();
    } catch (err) {
      console.error("Defective product upload validation error:", err);
      return res.status(500).json({ success: false, message: "Upload validation failed." });
    }
  },
  submitReport
);

router.get("/", protect, requireAdmin, getReports);

router.get("/:id", protect, requireAdmin, getReportById);

router.patch("/:id", protect, requireAdmin, requireSameOrigin, updateReportStatus);

// ── Chat routes ──
router.post("/:id/chat", protect, sendChatMessage);
router.get("/:id/chat", protect, getChatMessages);

module.exports = router;