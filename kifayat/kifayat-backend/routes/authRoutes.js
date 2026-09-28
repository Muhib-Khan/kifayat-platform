const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sniffUpload } = require("../utils/fileSniffer");
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  googleAuth,
  logout,
  heartbeat,
  getMe,
  updateProfile,
  verifyEmailUpdate,
  resendEmailUpdateOTP,
  deleteAccount,
  sendDeleteOTP,
  changePassword,
  verifyPasswordUpdate,
  forgotPassword,
  resetPassword,
  updateOrderConEmail,
  verifyOrderConEmail,
  resendOrderConEmailOTP,
  getShipmentEmails,
  sendShipmentEmailOTP,
  verifyShipmentEmailOTP,
  removeShipmentEmail,
} = require("../controllers/authController");
const { protect, softProtect } = require("../middleware/auth");

const router = express.Router();

// Avatar upload directory
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Avatar multer: memory storage + strict fileFilter (mimetype only)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Only images (JPEG, PNG, WebP, GIF) are allowed."));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Avatar upload — validate bytes against magic bytes, write with safe extension
router.post(
  "/avatar",
  protect,
  avatarUpload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

      // Sniff the actual file type from the uploaded buffer
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const sniffed = sniffUpload({ buffer: req.file.buffer }, "image");
      if (!sniffed || !allowedTypes.includes(sniffed.type)) {
        return res.status(400).json({ success: false, message: "Invalid image file." });
      }

      // Derive safe extension from sniffed type and persist to disk
      const extMap = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
      const safeExt = extMap[sniffed.type];
      const safeFilename = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}.${safeExt}`;
      const safePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(safePath, req.file.buffer);

      const User = require("../models/User");
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      user.avatar = `/uploads/${safeFilename}`;
      await user.save();
      return res.status(200).json({ success: true, avatar: user.avatar });
    } catch (err) {
      console.error("Avatar upload error:", err);
      return res.status(500).json({ success: false, message: "Failed to upload avatar." });
    }
  }
);

// Register
router.post("/register", register);
// Verify OTP
router.post("/verify-otp", verifyOTP);
// Resend OTP
router.post("/resend-otp", resendOTP);
// Login
router.post("/login", login);
// Google OAuth
router.post("/google", googleAuth);
// Logout
router.post("/logout", logout);
// Heartbeat
router.post("/heartbeat", heartbeat);
// Me (soft protect — no 401 on browser console)
router.get("/me", softProtect, getMe);
// Profile management (all protected)
router.put("/profile", protect, updateProfile);
// Legacy/documented aliases retained for clients using the original API names.
router.post("/update", protect, updateProfile);
router.post("/verify-email-update", protect, verifyEmailUpdate);
router.post("/resend-email-update-otp", protect, resendEmailUpdateOTP);
router.post("/send-delete-otp", protect, sendDeleteOTP);
router.delete("/account", protect, deleteAccount);
router.put("/password", protect, changePassword);
router.post("/update-password", protect, changePassword);
router.post("/verify-password-update", protect, verifyPasswordUpdate);

// Order confirmation email
router.put("/order-con-email", protect, updateOrderConEmail);
router.post("/verify-order-con-email", protect, verifyOrderConEmail);
router.post("/resend-order-con-email-otp", protect, resendOrderConEmailOTP);

// Shipment email management (replaces order-con-email for checkout flow)
router.get("/shipment-emails", protect, getShipmentEmails);
router.post("/shipment-emails/send-otp", protect, sendShipmentEmailOTP);
router.post("/shipment-emails/verify-otp", protect, verifyShipmentEmailOTP);
router.delete("/shipment-emails/:email", protect, removeShipmentEmail);

module.exports = router;