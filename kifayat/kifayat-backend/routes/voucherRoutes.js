const express = require("express");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");
const {
  generateVoucher,
  getAdminVouchers,
  getAvailableVouchers,
  buyVoucher,
  getMyVouchers,
  getAllPurchasedVouchers,
  deleteVoucher,
  giftVoucher,
  applyVoucher,
  unapplyVoucher,
} = require("../controllers/voucherController");

const CompensationVoucher = require("../models/CompensationVoucher");

const router = express.Router();

// ── Admin routes ──
router.post("/generate", protect, requireAdmin, requireSameOrigin, generateVoucher);
router.get("/admin", protect, requireAdmin, getAdminVouchers);
router.get("/admin/purchased", protect, requireAdmin, getAllPurchasedVouchers);
router.get("/admin/compensation", protect, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [vouchers, total] = await Promise.all([
      CompensationVoucher.find()
        .sort({ generated_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("user", "name email")
        .populate("cancelOrder", "orderId reason")
        .populate("products", "name")
        .lean(),
      CompensationVoucher.countDocuments(),
    ]);

    const stats = await CompensationVoucher.aggregate([
      { $group: { _id: "$used", count: { $sum: 1 } } },
    ]);

    return res.json({ success: true, vouchers, total, page: pageNum, pages: Math.ceil(total / limitNum), stats });
  } catch (err) {
    console.error("getCompensationVouchers error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch compensation vouchers." });
  }
});
router.post("/gift", protect, requireAdmin, requireSameOrigin, giftVoucher);
router.delete("/:id", protect, requireAdmin, requireSameOrigin, deleteVoucher);

// ── User routes ──
router.get("/available", protect, getAvailableVouchers);
router.post("/buy", protect, buyVoucher);
router.get("/mine", protect, getMyVouchers);
router.post("/apply", protect, applyVoucher);
router.post("/unapply", protect, unapplyVoucher);

module.exports = router;
