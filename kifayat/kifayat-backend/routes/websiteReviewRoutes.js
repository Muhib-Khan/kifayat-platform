const express = require("express");
const {
  createReview,
  getAllReviews,
  updateReview,
  deleteReview,
  togglePin,
} = require("../controllers/websiteReviewController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

router.route("/")
  .post(protect, createReview)
  .get(getAllReviews);

router.route("/:id")
  .put(protect, requireAdmin, updateReview)
  .delete(protect, requireAdmin, deleteReview);

router.patch("/:id/pin", protect, requireAdmin, togglePin);

module.exports = router;
