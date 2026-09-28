const WebsiteReview = require("../models/WebsiteReview");
const ShippingDetail = require("../models/ShippingDetail");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/website-reviews  (auth required)
// ─────────────────────────────────────────────────────────────────────────────
const createReview = async (req, res) => {
  try {
    const { rating, comment, response } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Comment is required." });
    }

    const doc = await WebsiteReview.create({
      user: req.user._id,
      name: req.user.name,
      rating,
      comment: comment.trim(),
      response: response || "",
    });

    return res.status(201).json({ success: true, review: doc });
  } catch (err) {
    console.error("createWebsiteReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to submit review." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/website-reviews  (public)
// Query: ?filter=good|bad|normal&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
const getAllReviews = async (req, res) => {
  try {
    const { filter, page: p, limit: l } = req.query;
    const page = Math.max(1, parseInt(p) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(l) || 20));
    const skip = (page - 1) * limit;

    let query = {};
    if (filter === "good") query.rating = { $gte: 4 };
    else if (filter === "bad") query.rating = { $lte: 2 };
    else if (filter === "normal") query.rating = 3;

    const [reviews, total] = await Promise.all([
      WebsiteReview.find(query)
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebsiteReview.countDocuments(query),
    ]);

    // Attach each reviewer's real delivery city (latest ShippingDetail) so the
    // storefront can show "verified buyer from <city>" instead of fake press.
    const userIds = reviews.map((r) => r.user).filter(Boolean);
    let cityByUser = {};
    try {
      const agg = await ShippingDetail.aggregate([
        { $match: { user: { $in: userIds }, courierCity: { $ne: "" } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$user", city: { $first: "$courierCity" } } },
      ]);
      for (const row of agg) cityByUser[row._id.toString()] = row.city;
    } catch {
      /* city enrichment is best-effort */
    }
    const enriched = reviews.map((r) => ({
      ...r,
      city: r.user ? cityByUser[r.user.toString()] || "" : "",
    }));

    const stats = await WebsiteReview.aggregate([
      {
        $group: {
          _id: null,
          average: { $avg: "$rating" },
          total: { $sum: 1 },
          counts: { $push: "$rating" },
        },
      },
    ]);

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0) {
      stats[0].counts.forEach((r) => { ratingDistribution[r] = (ratingDistribution[r] || 0) + 1; });
    }

    return res.status(200).json({
      success: true,
      reviews: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      average: stats.length > 0 ? Math.round(stats[0].average * 10) / 10 : 0,
      totalReviews: stats.length > 0 ? stats[0].total : 0,
      ratingDistribution,
    });
  } catch (err) {
    console.error("getAllWebsiteReviews error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/website-reviews/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const updateReview = async (req, res) => {
  try {
    const allowed = ["rating", "comment", "response"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const doc = await WebsiteReview.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    return res.status(200).json({ success: true, review: doc });
  } catch (err) {
    console.error("updateWebsiteReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to update review." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/website-reviews/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const deleteReview = async (req, res) => {
  try {
    const doc = await WebsiteReview.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }
    return res.status(200).json({ success: true, message: "Review deleted." });
  } catch (err) {
    console.error("deleteWebsiteReview error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete review." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/website-reviews/:id/pin  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const togglePin = async (req, res) => {
  try {
    const doc = await WebsiteReview.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }
    doc.pinned = !doc.pinned;
    await doc.save();
    return res.status(200).json({ success: true, review: doc });
  } catch (err) {
    console.error("toggleWebsiteReviewPin error:", err);
    return res.status(500).json({ success: false, message: "Failed to toggle pin." });
  }
};

module.exports = { createReview, getAllReviews, updateReview, deleteReview, togglePin };
