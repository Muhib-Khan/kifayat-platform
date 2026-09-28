const mongoose = require("mongoose");
const DiscountVoucher = require("../models/DiscountVoucher");
const PurchasedVoucher = require("../models/PurchasedVoucher");
const Product = require("../models/Product");
const User = require("../models/User");
const { recomputeVoucherUsed } = require("../utils/voucherLifecycle");

const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateVoucherCode(length = 10) {
  return crypto.randomBytes(length).toString("hex").toUpperCase().slice(0, length);
}

// ---------------------------------------------------------------------------
// Admin: Generate a new voucher
// ---------------------------------------------------------------------------
exports.generateVoucher = async (req, res) => {
  try {
    const { discount_percent, points_required, expires_at, max_uses } = req.body;

    if (!discount_percent || !points_required) {
      return res.status(400).json({
        success: false,
        message: "discount_percent and points_required are required.",
      });
    }

    const voucher = await DiscountVoucher.create({
      voucher_code: generateVoucherCode(),
      discount_percent,
      points_required,
      created_by: req.user._id,
      expires_at: expires_at ? new Date(expires_at) : null,
      max_uses: max_uses || null,
    });

    console.log(`[Voucher] Admin ${req.user.email} generated voucher ${voucher.voucher_code}`);

    res.status(201).json({ success: true, voucher });
  } catch (err) {
    console.error("Generate voucher error:", err);
    res.status(500).json({ success: false, message: "Failed to generate voucher." });
  }
};

// ---------------------------------------------------------------------------
// Admin: List all vouchers (with 2-minute visibility window)
// Purchased vouchers stay visible — marked with "Purchased by <email>".
// ---------------------------------------------------------------------------
exports.getAdminVouchers = async (req, res) => {
  try {
    // Mark vouchers older than 2 minutes as ended in the response
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    const vouchers = await DiscountVoucher.find({ is_active: true })
      .sort({ created_at: -1 })
      .populate("created_by", "name email")
      .populate("purchased_by", "name email")
      .lean();

    const mapped = vouchers.map((v) => {
      if (v.purchased_by) {
        return { ...v, status: "Purchased" };
      }
      const isExpired = v.created_at < twoMinutesAgo;
      return {
        ...v,
        status: isExpired ? "Ended" : "Active",
      };
    });

    // Deactivate only unpurchased expired vouchers in the background
    const expiredIds = mapped
      .filter((v) => v.status === "Ended")
      .map((v) => v._id);

    if (expiredIds.length > 0) {
      DiscountVoucher.updateMany(
        { _id: { $in: expiredIds } },
        { is_active: false }
      ).catch((err) => console.error("[Voucher] Deactivate expired error:", err));
    }

    // Keep Active + Purchased in `vouchers`; only fully ended ones move to `ended`
    const activeVouchers = mapped.filter((v) => v.status !== "Ended");

    res.json({ success: true, vouchers: activeVouchers, ended: mapped.filter((v) => v.status === "Ended") });
  } catch (err) {
    console.error("Get admin vouchers error:", err);
    res.status(500).json({ success: false, message: "Failed to load vouchers." });
  }
};

// ---------------------------------------------------------------------------
// User: List available vouchers (not purchased yet, still active)
// ---------------------------------------------------------------------------
exports.getAvailableVouchers = async (req, res) => {
  try {
    // Get IDs of vouchers this user already purchased
    const purchased = await PurchasedVoucher.find({ user: req.user._id })
      .select("voucher")
      .lean();
    const purchasedVoucherIds = purchased.map((p) => p.voucher.toString());

    // Also get vouchers the user already bought and have removed
    // Show only active vouchers that user hasn't bought and no one else has
    const vouchers = await DiscountVoucher.find({
      is_active: true,
      purchased_by: null,
      _id: { $nin: purchasedVoucherIds },
    })
      .sort({ created_at: -1 })
      .select("voucher_code discount_percent points_required expires_at created_at")
      .lean();

    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const available = vouchers.filter((v) => {
      if (v.expires_at && new Date(v.expires_at) < now) return false;
      // Flash-sale vouchers without expiry are only available for 2 minutes
      if (!v.expires_at && v.created_at < twoMinutesAgo) return false;
      return true;
    });

    res.json({ success: true, vouchers: available, userPoints: req.user.loyaltyPoints });
  } catch (err) {
    console.error("Get available vouchers error:", err);
    res.status(500).json({ success: false, message: "Failed to load vouchers." });
  }
};

// ---------------------------------------------------------------------------
// User: Buy a voucher
// ---------------------------------------------------------------------------
exports.buyVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { voucherId } = req.body;

    if (!voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "voucherId is required." });
    }

    const voucher = await DiscountVoucher.findById(voucherId).session(session);
    if (!voucher) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Voucher not found." });
    }

    if (!voucher.is_active) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Voucher is no longer active." });
    }

    // Expired vouchers can't be purchased
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "This voucher has expired." });
    }

    // A voucher that was already purchased/gifted to someone else is gone
    if (voucher.purchased_by && String(voucher.purchased_by) !== String(req.user._id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Voucher is no longer available." });
    }

    // Check if already purchased by this user
    const alreadyPurchased = await PurchasedVoucher.findOne({
      user: req.user._id,
      voucher: voucherId,
    }).session(session);

    if (alreadyPurchased) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "You already purchased this voucher." });
    }

    const user = await User.findById(req.user._id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if ((user.loyaltyPoints || 0) < voucher.points_required) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Insufficient points. You need ${voucher.points_required} points but have ${user.loyaltyPoints || 0}.`,
      });
    }

    // Deduct points
    user.loyaltyPoints -= voucher.points_required;

    await user.save({ session });

    // Create purchased record
    const purchased = await PurchasedVoucher.create(
      [
        {
          user: user._id,
          voucher: voucher._id,
          voucher_code: voucher.voucher_code,
          discount_percent: voucher.discount_percent,
          points_spent: voucher.points_required,
          total_uses: Math.max(1, voucher.max_uses || 1),
          expires_at: voucher.expires_at || null,
          source: "purchased",
        },
      ],
      { session }
    );

    // Mark the voucher as taken so it disappears from the available list and
    // stays visible on the admin side tagged with the buyer. The claim is
    // atomic — two simultaneous purchases of the same voucher can never both
    // win, even though each already passed the "already purchased" check.
    const claimed = await DiscountVoucher.findOneAndUpdate(
      { _id: voucher._id, purchased_by: null },
      { $set: { purchased_by: user._id, purchased_at: new Date() } },
      { session }
    );
    if (!claimed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Voucher is no longer available." });
    }

    await session.commitTransaction();
    session.endSession();

    console.log(
      `[Voucher] User ${user.email} bought voucher ${voucher.voucher_code} ` +
        `(${voucher.discount_percent}%) for ${voucher.points_required} points.`
    );

    res.status(201).json({
      success: true,
      purchased: purchased[0],
      remainingPoints: user.loyaltyPoints,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Buy voucher error:", err);
    res.status(500).json({ success: false, message: "Failed to purchase voucher." });
  }
};

// ---------------------------------------------------------------------------
// User: Get my vouchers (purchased + gifted)
// ---------------------------------------------------------------------------
exports.getMyVouchers = async (req, res) => {
  try {
    const vouchers = await PurchasedVoucher.find({ user: req.user._id })
      .sort({ purchased_at: -1 })
      .populate("voucher", "voucher_code discount_percent")
      .populate("applied_products.product", "name slug")
      .populate("products", "name slug")
      .populate("gifted_by", "name email")
      .lean();

    const now = new Date();
    const mapped = vouchers.map((v) => {
      const applied = v.applied_products || [];
      const reservedCount = applied.filter((a) => a.status === "reserved").length;
      const consumedCount = applied.filter((a) => a.status === "consumed").length;
      const totalUses = v.total_uses || 1;
      const available = Math.max(0, totalUses - reservedCount - consumedCount);
      const isExpired = !!(v.expires_at && new Date(v.expires_at) < now);

      let status = "Available";
      if (isExpired) status = "Expired";
      else if (available <= 0 && reservedCount === 0) status = "Used Up";
      else if (reservedCount > 0) status = "Applied";

      return {
        ...v,
        used_count: reservedCount + consumedCount,
        reserved_count: reservedCount,
        consumed_count: consumedCount,
        remaining_uses: available,
        is_expired: isExpired,
        status,
      };
    });

    res.json({ success: true, vouchers: mapped });
  } catch (err) {
    console.error("Get my vouchers error:", err);
    res.status(500).json({ success: false, message: "Failed to load your vouchers." });
  }
};

// ---------------------------------------------------------------------------
// Admin: Gift a voucher to a user at the moment (from stock-alert email)
// Body: { userId, voucherId?, discount_percent?, voucher_type?, productIds?, max_uses?, expires_at? }
// If voucherId is given, that voucher is gifted (and marked purchased_by).
// Otherwise a fresh voucher is generated and gifted immediately.
// ---------------------------------------------------------------------------
exports.giftVoucher = async (req, res) => {
  try {
    const {
      userId,
      email,
      voucherId,
      discount_percent,
      voucher_type,
      productIds = [],
      max_uses,
      expires_at,
    } = req.body;

    let targetUser = null;
    if (userId) {
      targetUser = await User.findById(userId).select("name email");
      if (!targetUser) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
    } else if (email && String(email).trim()) {
      targetUser = await User.findOne({ email: String(email).trim().toLowerCase() })
        .select("name email");
      if (!targetUser) {
        return res.status(404).json({ success: false, message: "No account found for that email." });
      }
    } else {
      return res.status(400).json({ success: false, message: "userId or email is required." });
    }

    let voucher = null;
    let giftPercent = Number(discount_percent);
    let giftExpiry = expires_at ? new Date(expires_at) : null;
    const validType = ["discount_all", "discount_specific", "free_product"].includes(voucher_type)
      ? voucher_type
      : "discount_all";

    if (voucherId) {
      voucher = await DiscountVoucher.findById(voucherId);
      if (!voucher) {
        return res.status(404).json({ success: false, message: "Voucher not found." });
      }
      if (voucher.purchased_by && String(voucher.purchased_by) !== String(targetUser._id)) {
        return res.status(400).json({ success: false, message: "That voucher was already taken by another user." });
      }
      giftPercent = voucher.discount_percent;
      giftExpiry = giftExpiry || voucher.expires_at || null;
      voucher.purchased_by = targetUser._id;
      voucher.purchased_at = new Date();
      await voucher.save();
    } else {
      if (!giftPercent || giftPercent < 1 || giftPercent > 100) {
        return res.status(400).json({ success: false, message: "Enter a valid discount % (1-100)." });
      }
      voucher = await DiscountVoucher.create({
        voucher_code: generateVoucherCode(),
        discount_percent: giftPercent,
        points_required: 0,
        created_by: req.user._id,
        expires_at: giftExpiry,
        max_uses: max_uses || null,
        is_active: true,
        purchased_by: targetUser._id,
        purchased_at: new Date(),
      });
    }

    const productList = Array.isArray(productIds) ? productIds : [];
    const totalUses = Math.max(1, productList.length, Number(max_uses) || 1);

    const gifted = await PurchasedVoucher.create({
      user: targetUser._id,
      voucher: voucher._id,
      voucher_code: voucher.voucher_code,
      discount_percent: giftPercent,
      points_spent: 0,
      total_uses: totalUses,
      expires_at: giftExpiry,
      source: "gifted",
      gifted_by: req.user._id,
      gifted_at: new Date(),
      voucher_type: validType,
      products: productList,
    });

    console.log(
      `[Voucher] Admin ${req.user.email} gifted voucher ${voucher.voucher_code} ` +
        `(${giftPercent}%, ${productList.length} product(s)) to ${targetUser.email}`
    );

    res.status(201).json({
      success: true,
      voucher: {
        ...gifted.toObject(),
        user: { _id: targetUser._id, name: targetUser.name, email: targetUser.email },
      },
    });
  } catch (err) {
    console.error("Gift voucher error:", err);
    res.status(500).json({ success: false, message: "Failed to gift voucher." });
  }
};

// ---------------------------------------------------------------------------
// User: Apply a purchased voucher to a single product
// ---------------------------------------------------------------------------
exports.applyVoucher = async (req, res) => {
  try {
    const { purchasedVoucherId, productId } = req.body;

    if (!purchasedVoucherId || !productId) {
      return res
        .status(400)
        .json({ success: false, message: "purchasedVoucherId and productId are required." });
    }

    const pv = await PurchasedVoucher.findOne({
      _id: purchasedVoucherId,
      user: req.user._id,
    });
    if (!pv) {
      return res.status(404).json({ success: false, message: "Voucher not found." });
    }

    // Expiry — a voucher can only be applied before it expires
    if (pv.expires_at && new Date(pv.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "This voucher has expired." });
    }

    // Uses — one voucher can only be applied to as many products as its uses allow
    const usedCount = (pv.applied_products || []).length;
    if (usedCount >= (pv.total_uses || 1)) {
      return res.status(400).json({ success: false, message: "This voucher has no uses left." });
    }

    // Same voucher twice on one product
    if (
      (pv.applied_products || []).some((a) => a.product && String(a.product) === String(productId))
    ) {
      return res
        .status(400)
        .json({ success: false, message: "This voucher is already applied to this product." });
    }

    // One voucher per product — no other voucher may be applied on the same product
    const other = await PurchasedVoucher.findOne({
      user: req.user._id,
      _id: { $ne: pv._id },
      "applied_products.product": productId,
    });
    if (other) {
      return res.status(400).json({
        success: false,
        message: "Another voucher is already applied to this product. Remove it first.",
      });
    }

    // A gifted voucher can only be used on the products written on it
    if (
      pv.source === "gifted" &&
      Array.isArray(pv.products) &&
      pv.products.length > 0 &&
      !pv.products.some((p) => p && String(p) === String(productId))
    ) {
      return res.status(400).json({
        success: false,
        message: "This gifted voucher can only be used on the products written on it.",
      });
    }

    const product = await Product.findById(productId).select("slug name").lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Atomic push: only succeeds if total_uses not exceeded (prevents race condition)
    const pushResult = await PurchasedVoucher.findOneAndUpdate(
      {
        _id: pv._id,
        user: req.user._id,
        $expr: { $lt: [{ $size: "$applied_products" }, pv.total_uses || 1] },
      },
      {
        $push: {
          applied_products: {
            product: productId,
            slug: product.slug || "",
            applied_at: new Date(),
            status: "reserved",
            order: null,
          },
        },
      },
      { new: true },
    );

    if (!pushResult) {
      return res.status(400).json({ success: false, message: "This voucher has no uses left." });
    }

    // Reload to get updated applied_products
    pv.applied_products = pushResult.applied_products;
    recomputeVoucherUsed(pv);
    await pv.save();

    console.log(
      `[Voucher] User ${req.user.email} reserved voucher ${pv._id} (${pv.discount_percent}%) on product ${productId}. ` +
        `${pv.applied_products.length}/${pv.total_uses} uses claimed.`
    );

    res.json({
      success: true,
      voucher: {
        ...pv.toObject(),
        reserved_count: pv.applied_products.filter((a) => a.status === "reserved").length,
        consumed_count: pv.applied_products.filter((a) => a.status === "consumed").length,
        used_count: pv.applied_products.length,
        remaining_uses: Math.max(0, (pv.total_uses || 1) - pv.applied_products.length),
      },
    });
  } catch (err) {
    console.error("Apply voucher error:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// User: Remove an applied voucher from a product (frees one use)
// ---------------------------------------------------------------------------
exports.unapplyVoucher = async (req, res) => {
  try {
    const { purchasedVoucherId, productId } = req.body;

    if (!purchasedVoucherId || !productId) {
      return res
        .status(400)
        .json({ success: false, message: "purchasedVoucherId and productId are required." });
    }

    const pv = await PurchasedVoucher.findOne({
      _id: purchasedVoucherId,
      user: req.user._id,
    });
    if (!pv) {
      return res.status(404).json({ success: false, message: "Voucher not found." });
    }

    const before = (pv.applied_products || []).length;

    // Only reserved uses can be released — consumed uses belong to a placed order.
    const consumedEntry = (pv.applied_products || []).find(
      (a) => a.status === "consumed" && String(a.product) === String(productId)
    );
    if (consumedEntry) {
      return res.status(400).json({
        success: false,
        message: "This voucher use was already consumed by an order and cannot be removed.",
      });
    }

    pv.applied_products = (pv.applied_products || []).filter(
      (a) => !(a.status === "reserved" && String(a.product) === String(productId))
    );

    if (pv.applied_products.length !== before) {
      recomputeVoucherUsed(pv);
      await pv.save();
    }

    res.json({
      success: true,
      voucher: {
        ...pv.toObject(),
        reserved_count: pv.applied_products.filter((a) => a.status === "reserved").length,
        consumed_count: pv.applied_products.filter((a) => a.status === "consumed").length,
        used_count: pv.applied_products.length,
        remaining_uses: Math.max(0, (pv.total_uses || 1) - pv.applied_products.length),
      },
    });
  } catch (err) {
    console.error("Unapply voucher error:", err);
    res.status(500).json({ success: false, message: "Failed to update voucher." });
  }
};

// ---------------------------------------------------------------------------
// Admin: Get all purchased vouchers (reporting)
// ---------------------------------------------------------------------------
exports.getAllPurchasedVouchers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const total = await PurchasedVoucher.countDocuments();
    const vouchers = await PurchasedVoucher.find()
      .sort({ purchased_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("user", "name email")
      .populate("voucher", "voucher_code discount_percent")
      .lean();

    res.json({
      success: true,
      vouchers,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Get all purchased vouchers error:", err);
    res.status(500).json({ success: false, message: "Failed to load vouchers." });
  }
};

// ---------------------------------------------------------------------------
// Admin: Delete a voucher
// ---------------------------------------------------------------------------
exports.deleteVoucher = async (req, res) => {
  try {
    const voucher = await DiscountVoucher.findByIdAndDelete(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found." });
    }
    console.log(`[Voucher] Admin ${req.user.email} deleted voucher ${voucher.voucher_code}`);
    res.json({ success: true, message: "Voucher deleted." });
  } catch (err) {
    console.error("Delete voucher error:", err);
    res.status(500).json({ success: false, message: "Failed to delete voucher." });
  }
};

// ---------------------------------------------------------------------------
// Reservation sweeper — releases reserved uses that were never converted into
// an order (e.g. checkout abandoned for a long time). Runs in the background.
// ---------------------------------------------------------------------------
exports.startVoucherReservationSweeper = function startVoucherReservationSweeper() {
  const HOLD_HOURS = 48;
  const cutoff = () => new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000);

  const run = async () => {
    try {
      const c = cutoff();
      const docs = await PurchasedVoucher.find({
        "applied_products.status": "reserved",
        "applied_products.applied_at": { $lt: c },
      }).select("applied_products total_uses used used_at");

      let released = 0;
      for (const pv of docs) {
        const before = pv.applied_products.length;
        pv.applied_products = (pv.applied_products || []).filter(
          (a) => !(a.status === "reserved" && a.applied_at < c)
        );
        if (pv.applied_products.length !== before) {
          recomputeVoucherUsed(pv);
          await pv.save();
          released += before - pv.applied_products.length;
        }
      }
      if (released > 0) {
        console.log(`[Voucher] Sweeper released ${released} stale reservation(s) older than ${HOLD_HOURS}h.`);
      }
    } catch (err) {
      console.error("[Voucher] Reservation sweeper error:", err);
    }
  };

  setTimeout(run, 5 * 60 * 1000);
  setInterval(run, 15 * 60 * 1000);
  console.log("  ? Voucher reservation sweeper: every 15 min");
};
