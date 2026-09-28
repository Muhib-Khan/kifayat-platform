const Review = require("../models/Review");
const { escapeRegex } = require("../utils/safeRegex");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews  (authenticated user — create a review)
// ─────────────────────────────────────────────────────────────────────────────
const createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: "Product ID and rating are required." });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    // Check if already reviewed
    const existing = await Review.findOne({ user: req.user._id, product: productId });
    if (existing) {
      // Update existing review
      existing.rating = rating;
      existing.comment = (comment || "").trim();
      await existing.save();
      return res.status(200).json({ success: true, message: "Review updated.", review: existing });
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating,
      comment: (comment || "").trim(),
    });

    return res.status(201).json({ success: true, message: "Review submitted.", review });
  } catch (err) {
    console.error("createReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to submit review." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/:productId  (get all reviews for a product)
// Optional ?filter=good|bad|normal
// ─────────────────────────────────────────────────────────────────────────────
const getProductReviews = async (req, res) => {
  try {
    const { filter } = req.query;
    let query = { product: req.params.productId };

    if (filter === "good") query.rating = { $gte: 4 };
    else if (filter === "bad") query.rating = { $lte: 2 };
    else if (filter === "normal") query.rating = 3;

    const reviews = await Review.find(query)
      .sort({ pinned: -1, createdAt: -1 })
      .populate("user", "name");

    const avgRating = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    return res.status(200).json({
      success: true,
      reviews,
      avgRating: Number(avgRating),
      totalReviews: reviews.length,
    });
  } catch (err) {
    console.error("getProductReviews error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/check/:productId  (check if user can review this product)
// ─────────────────────────────────────────────────────────────────────────────
const checkReviewEligibility = async (req, res) => {
  try {
    // Any authenticated user can review any product
    const existingReview = await Review.findOne({
      user: req.user._id,
      product: req.params.productId,
    });

    return res.status(200).json({
      success: true,
      canReview: true,
      hasReviewed: !!existingReview,
      existingReview: existingReview || null,
    });
  } catch (err) {
    console.error("checkReviewEligibility error:", err);
    return res.status(500).json({ success: false, message: "Failed to check eligibility." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/admin/:productId  (admin — get all reviews with user info)
// ─────────────────────────────────────────────────────────────────────────────
const getAdminProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .lean();

    return res.status(200).json({ success: true, reviews });
  } catch (err) {
    console.error("getAdminProductReviews error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/reviews/:id  (admin — delete a review)
// ─────────────────────────────────────────────────────────────────────────────
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }
    return res.status(200).json({ success: true, message: "Review deleted." });
  } catch (err) {
    console.error("deleteReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete review." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/reviews/:id/pin  (admin — toggle pin status; only one pinned per product)
// ─────────────────────────────────────────────────────────────────────────────
const togglePinReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    if (review.pinned) {
      review.pinned = false;
    } else {
      // Unpin all other reviews for this product, then pin this one
      await Review.updateMany({ product: review.product, pinned: true }, { pinned: false });
      review.pinned = true;
    }

    await review.save();
    return res.status(200).json({ success: true, message: `Review ${review.pinned ? "pinned" : "unpinned"}.`, pinned: review.pinned });
  } catch (err) {
    console.error("togglePinReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to toggle pin." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/:id/reviewer-info  (admin — get reviewer's UserFinalData)
// ─────────────────────────────────────────────────────────────────────────────
const getReviewerInfo = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("user", "name email").lean();
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    const UserFinalData = require("../models/UserFinalData");
    const userData = await UserFinalData.findOne({ email: review.user.email }).lean();

    return res.status(200).json({ success: true, userInfo: userData || review.user });
  } catch (err) {
    console.error("getReviewerInfo error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reviewer info." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/reviews/:id  (admin — edit review comment / rating / response)
// ─────────────────────────────────────────────────────────────────────────────
const updateReview = async (req, res) => {
  try {
    const allowed = ["rating", "comment", "response"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const doc = await Review.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    return res.status(200).json({ success: true, review: doc });
  } catch (err) {
    console.error("updateReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to update review." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/admin  (admin — list all reviews across all products)
// Optional: ?page=1&limit=20&rating=5&q=searchTerm
// ─────────────────────────────────────────────────────────────────────────────
const getAllReviewsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, rating, q } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (rating) query.rating = Number(rating);
    if (q) {
      query.$or = [
        { comment: { $regex: escapeRegex(q), $options: "i" } },
      ];
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("user", "name email")
        .populate("product", "name imageUrl slug")
        .lean(),
      Review.countDocuments(query),
    ]);

    const ratingDistribution = {};
    const dist = await Review.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);
    dist.forEach((d) => { ratingDistribution[d._id] = d.count; });

    const avgResult = await Review.aggregate([
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]);
    const average = avgResult[0] ? Number(avgResult[0].avg.toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      reviews,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      average,
      ratingDistribution,
    });
  } catch (err) {
    console.error("getAllReviewsAdmin error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
  }
};

module.exports = { createReview, getProductReviews, checkReviewEligibility, getAdminProductReviews, getAllReviewsAdmin, deleteReview, togglePinReview, getReviewerInfo, updateReview };