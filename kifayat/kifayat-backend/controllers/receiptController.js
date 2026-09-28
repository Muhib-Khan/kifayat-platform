const fs = require("fs");
const path = require("path");
const ProductReceipt = require("../models/ProductReceipt");
const User = require("../models/User");
const OrderHistory = require("../models/OrderHistory");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const { logActivity, ACTIONS } = require("../utils/activityLogger");
const { sniffUpload } = require("../utils/fileSniffer");
const { sendAdminNotification } = require("../utils/email");

const uploadsDir = path.join(__dirname, "..", "uploads", "receipts");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── POST /api/receipts  (authenticated user — submit receipt) ────────────────
const submitReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a product image." });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required." });
    }

    // Validate image bytes
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const sniffed = sniffUpload({ buffer: req.file.buffer }, "image");
    if (!sniffed || !allowedTypes.includes(sniffed.type)) {
      return res.status(400).json({ success: false, message: "Invalid image file. Only JPEG, PNG, WebP, GIF allowed." });
    }

    // Find the order in OrderHistory or MainOrderCSVData
    let orderDoc = await OrderHistory.findById(orderId).lean();
    let source = "history";
    if (!orderDoc) {
      orderDoc = await MainOrderCSVData.findById(orderId).lean();
      source = "queue";
    }
    if (!orderDoc) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Ensure the order belongs to this user
    const userId = String(req.user._id);
    const orderUserId = orderDoc.user ? String(orderDoc.user.userId || orderDoc.user) : "";
    const orderEmail = String(orderDoc.email || "").trim().toLowerCase();
    const userEmail = String(req.user.email || "").trim().toLowerCase();

    if (orderUserId !== userId && orderEmail !== userEmail) {
      return res.status(403).json({ success: false, message: "This order does not belong to you." });
    }

    // Check if already submitted (atomic — prevents duplicate submissions)
    const existing = await ProductReceipt.findOneAndUpdate(
      {
        user: req.user._id,
        orderId: orderId,
        status: { $in: ["pending", "approved"] },
      },
      { $setOnInsert: { user: req.user._id, orderId } },
      { upsert: true, new: false, rawResult: true },
    ).lean();

    if (existing?.lastErrorObject?.updatedExisting) {
      const doc = existing.value;
      return res.status(400).json({
        success: false,
        message: doc && doc.status === "pending"
          ? "You already have a pending receipt for this order."
          : "This order's receipt has already been approved.",
      });
    }

    // Clean up the upsert placeholder if it was inserted (race lost, but insert happened)
    if (existing?.lastErrorObject?.upserted) {
      await ProductReceipt.deleteOne({ _id: existing.lastErrorObject.upserted });
    }

    // Save image to disk
    const extMap = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    const safeExt = extMap[sniffed.type];
    const safeFilename = `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}.${safeExt}`;
    const safePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(safePath, req.file.buffer);

    // Normalize items
    let items = [];
    if (source === "history") {
      const histMod = require("../models/OrderHistory");
      const raw = await histMod.findById(orderId).lean();
      if (Array.isArray(raw?.products) && raw.products.length > 0) {
        items = raw.products.map((p) => ({
          name: String(p?.name || ""),
          price: Number(p?.price || 0),
          quantity: Number(p?.quantity || 1),
          imageUrl: String(p?.imageUrl || ""),
        }));
      }
    } else {
      const raw = orderDoc;
      const count = Math.max(0, Number(raw.productCount) || 0);
      for (let i = 1; i <= count; i++) {
        const name = String(raw[`productName${i}`] || "");
        if (!name) continue;
        items.push({
          name,
          price: Number(raw[`productPrice${i}`] || 0),
          quantity: Number(raw[`qty${i}`] || 1),
          imageUrl: "",
        });
      }
    }

    const totalAmount = Number(orderDoc.sellPrice || orderDoc.totalAmount || 0);

    const receipt = await ProductReceipt.create({
      user: req.user._id,
      orderHistoryId: source === "history" ? orderDoc._id : undefined,
      orderId,
      items,
      totalAmount,
      image: `/uploads/receipts/${safeFilename}`,
      status: "pending",
    });

    // Notify admin via Socket.IO (admin room only)
    const io = req.app?.get("io");
    if (io) {
      io.to("admin").emit("receipt_submitted", {
        receiptId: String(receipt._id),
        orderId,
        userName: req.user.name || "Customer",
        totalAmount,
        itemCount: items.length,
        createdAt: receipt.createdAt,
      });
    }

    // Email notification to admin
    try {
      const points = Math.floor(totalAmount / 300) * 5;
      await sendAdminNotification(
        "New Product Receipt Submitted",
        `<strong>${req.user.name || req.user.email}</strong> submitted a receipt for order <strong>${orderDoc.orderID || orderId}</strong>.<br><br>` +
        `Total: <strong>Rs ${totalAmount.toLocaleString()}</strong> · Items: ${items.length}<br>` +
        `Potential points: <strong>${points}</strong><br><br>` +
        `Please review in the Admin Dashboard → Receipts.`
      );
    } catch (_) {}

    await logActivity({
      user: req.user,
      action: ACTIONS.ORDER_STATUS_CHANGED,
      description: `Submitted receipt for order ${orderId}`,
      req,
      metadata: { receiptId: String(receipt._id), orderId },
    });

    return res.status(201).json({
      success: true,
      message: "Receipt submitted! Waiting for admin approval.",
      receipt: { id: String(receipt._id), status: receipt.status, image: receipt.image },
    });
  } catch (err) {
    console.error("submitReceipt error:", err);
    return res.status(500).json({ success: false, message: "Failed to submit receipt." });
  }
};

// ── GET /api/receipts/mine  (authenticated user — my receipts) ──────────────
const getMyReceipts = async (req, res) => {
  try {
    const receipts = await ProductReceipt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, receipts });
  } catch (err) {
    console.error("getMyReceipts error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch receipts." });
  }
};

// ── GET /api/receipts/admin  (admin — list all receipts) ────────────────────
const getAdminReceipts = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [receipts, total] = await Promise.all([
      ProductReceipt.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("user", "name email")
        .populate("reviewedBy", "name email")
        .lean(),
      ProductReceipt.countDocuments(filter),
    ]);

    const stats = await ProductReceipt.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      receipts,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      stats,
    });
  } catch (err) {
    console.error("getAdminReceipts error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch receipts." });
  }
};

// ── PATCH /api/receipts/:id/approve  (admin — approve receipt) ──────────────
const approveReceipt = async (req, res) => {
  try {
    const receipt = await ProductReceipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found." });
    }
    if (receipt.status !== "pending") {
      return res.status(400).json({ success: false, message: `Receipt already ${receipt.status}.` });
    }

    // Calculate points: 5 points per 300 Rs
    const points = Math.floor(receipt.totalAmount / 300) * 5;

    // Award points to user
    const user = await User.findById(receipt.user);
    if (user) {
      user.loyaltyPoints = (user.loyaltyPoints || 0) + points;
      await user.save();
    }

    receipt.status = "approved";
    receipt.reviewedBy = req.user._id;
    receipt.reviewedAt = new Date();
    receipt.pointsAwarded = points;
    await receipt.save();

    // Notify user via Socket.IO (personal room only)
    const io = req.app?.get("io");
    if (io) {
      io.to(`user-${receipt.user}`).emit("receipt_approved", {
        receiptId: String(receipt._id),
        orderId: receipt.orderId,
        points,
      });
    }

    await logActivity({
      user: req.user,
      action: ACTIONS.ORDER_STATUS_CHANGED,
      description: `Approved receipt for order ${receipt.orderId} — ${points} points awarded to user`,
      req,
      metadata: { receiptId: String(receipt._id), orderId: receipt.orderId, points },
    });

    return res.json({ success: true, message: `Receipt approved. ${points} loyalty points awarded.`, points });
  } catch (err) {
    console.error("approveReceipt error:", err);
    return res.status(500).json({ success: false, message: "Failed to approve receipt." });
  }
};

// ── PATCH /api/receipts/:id/reject  (admin — reject receipt) ────────────────
const rejectReceipt = async (req, res) => {
  try {
    const { reason } = req.body;
    const receipt = await ProductReceipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found." });
    }
    if (receipt.status !== "pending") {
      return res.status(400).json({ success: false, message: `Receipt already ${receipt.status}.` });
    }

    receipt.status = "rejected";
    receipt.reviewedBy = req.user._id;
    receipt.reviewedAt = new Date();
    receipt.reviewNote = reason || "";
    await receipt.save();

    // Notify user via Socket.IO (personal room only)
    const io = req.app?.get("io");
    if (io) {
      io.to(`user-${receipt.user}`).emit("receipt_rejected", {
        receiptId: String(receipt._id),
        orderId: receipt.orderId,
        reason: reason || "",
      });
    }

    await logActivity({
      user: req.user,
      action: ACTIONS.ORDER_STATUS_CHANGED,
      description: `Rejected receipt for order ${receipt.orderId}${reason ? `: ${reason}` : ""}`,
      req,
      metadata: { receiptId: String(receipt._id), orderId: receipt.orderId, reason },
    });

    return res.json({ success: true, message: "Receipt rejected." });
  } catch (err) {
    console.error("rejectReceipt error:", err);
    return res.status(500).json({ success: false, message: "Failed to reject receipt." });
  }
};

module.exports = {
  submitReceipt,
  getMyReceipts,
  getAdminReceipts,
  approveReceipt,
  rejectReceipt,
};
