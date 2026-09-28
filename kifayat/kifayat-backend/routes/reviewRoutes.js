const express = require("express");
const {
  createReview,
  getProductReviews,
  checkReviewEligibility,
  getAdminProductReviews,
  getAllReviewsAdmin,
  deleteReview,
  togglePinReview,
  getReviewerInfo,
  updateReview,
} = require("../controllers/reviewController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

router.post("/", protect, createReview);
router.get("/check/:productId", protect, checkReviewEligibility);
router.get("/check-eligibility/:productId", protect, checkReviewEligibility);
router.get("/admin", protect, requireAdmin, getAllReviewsAdmin);
router.get("/admin/:productId", protect, requireAdmin, getAdminProductReviews);
router.put("/:id", protect, requireAdmin, updateReview);
router.delete("/:id", protect, requireAdmin, deleteReview);
router.patch("/:id/pin", protect, requireAdmin, togglePinReview);
router.get("/:id/reviewer-info", protect, requireAdmin, getReviewerInfo);
router.get("/:productId", getProductReviews);

module.exports = router;
