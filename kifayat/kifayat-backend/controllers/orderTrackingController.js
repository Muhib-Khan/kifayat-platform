const mongoose = require("mongoose");
const OrderHistory = require("../models/OrderHistory");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const CancelOrder = require("../models/CancelOrder");
const { logActivity, ACTIONS } = require("../utils/activityLogger");
const { restoreOrderVoucherUses, burnConsumedVoucherUses } = require("../utils/voucherLifecycle");
const { sendOrderCancelledByUserEmail } = require("../utils/email");

const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

// Normalize the structured `products` array stored on OrderHistory (or the
// legacy numbered columns for older records) into a plain line-item shape the
// admin panel and the "Your Orders" page can render directly.
function historyProducts(doc) {
  if (Array.isArray(doc.products) && doc.products.length > 0) {
    return doc.products.map((p) => ({
      name: String(p?.name ?? ""),
      sku: String(p?.sku ?? ""),
      variationName: String(p?.variationName ?? ""),
      price: Number(p?.price ?? 0),
      quantity: Number(p?.quantity ?? 1),
      imageUrl: String(p?.imageUrl ?? ""),
    }));
  }
  const items = [];
  const count = Math.max(0, Number(doc.productCount) || 0);
  for (let i = 1; i <= count; i++) {
    items.push({
      name: String(doc[`productName${i}`] ?? ""),
      sku: String(doc[`productSku${i}`] ?? ""),
      variationName: String(doc[`variationName${i}`] ?? ""),
      price: Number(doc[`productPrice${i}`] ?? 0),
      quantity: Number(doc[`qty${i}`] ?? 1),
      imageUrl: "",
    });
  }
  return items.filter((p) => p.name || p.sku);
}

// Same normalization for MainOrderCSVData rows (pre-download queue), whose
// products live in numbered productN/variationN/qtyN/productNameN columns.
function csvProducts(doc) {
  const items = [];
  const count = Math.max(0, Number(doc.productCount) || 0);
  for (let i = 1; i <= count; i++) {
    items.push({
      name: String(doc[`productName${i}`] ?? ""),
      sku: String(doc[`productSku${i}`] ?? ""),
      variationName: String(doc[`variationName${i}`] ?? ""),
      price: Number(doc[`productPrice${i}`] ?? 0),
      quantity: Number(doc[`qty${i}`] ?? 1),
      imageUrl: "",
    });
  }
  return items.filter((p) => p.name || p.sku);
}

function mapHistory(doc) {
  return {
    id: String(doc._id),
    orderID: String(doc.orderID ?? ""),
    sourceOrderID: String(doc.sourceOrderID ?? doc.orderID ?? ""),
    status: doc.trackingStatus || "pending",
    statusUpdatedAt: doc.trackingStatusUpdatedAt || null,
    name: String(doc.name ?? ""),
    city: String(doc.courierCity ?? ""),
    address: String(doc.address ?? ""),
    phone: String(doc.phoneNumber ?? ""),
    sellPrice: Number(doc.sellPrice ?? 0),
    exportedAt: doc.exportedAt || doc.createdAt || null,
    products: historyProducts(doc),
    stockAlerts: Array.isArray(doc.stockAlerts) ? doc.stockAlerts : [],
    user: doc.user
      ? {
          userId: String(doc.user.userId ?? ""),
          name: String(doc.user.name ?? ""),
          email: String(doc.user.email ?? ""),
        }
      : null,
    source: "exported",
  };
}

function mapQueue(doc) {
  return {
    id: String(doc._id),
    orderID: String(doc.orderID ?? ""),
    sourceOrderID: String(doc.orderID ?? ""),
    // Not yet downloaded to the main order CSV — show as pending until the
    // admin exports it and the tracking status can be managed.
    status: "pending",
    statusUpdatedAt: null,
    name: String(doc.name ?? ""),
    city: String(doc.courierCity ?? ""),
    address: String(doc.address ?? ""),
    phone: String(doc.phoneNumber ?? ""),
    sellPrice: Number(doc.sellPrice ?? 0),
    exportedAt: doc.createdAt || null,
    products: csvProducts(doc),
    stockAlerts: Array.isArray(doc.stockAlerts) ? doc.stockAlerts : [],
    user: null,
    source: "queue",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/order-status  (admin)
// Lists the orders that were included in the main order CSV download —
// the OrderHistory archive is written at download time, so pending
// confirmations and pre-orders never appear here.
// ─────────────────────────────────────────────────────────────────────────────
const getMainOrderStatusList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      OrderHistory.find({}).sort({ exportedAt: -1 }).skip(skip).limit(limit).lean(),
      OrderHistory.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      orders: docs.map(mapHistory),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("getMainOrderStatusList error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch tracked orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/order-status/:id  (admin)
// Updates the tracking status of a main order and pushes a realtime
// `order_status_updated` event so the owning customer's open session shows a
// toast immediately.
// ─────────────────────────────────────────────────────────────────────────────
const updateTrackingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const doc = await OrderHistory.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Tracked order not found." });
    }

    const oldStatus = doc.trackingStatus || "pending";
    doc.trackingStatus = status;
    doc.trackingStatusUpdatedAt = new Date();
    await doc.save();

    // Voucher use lifecycle on terminal tracking states:
    //  - cancelled  -> consumed uses are given back to the user
    //  - delivered  -> consumed uses are burned (the order is complete, the
    //    voucher's remaining uses must unlock for other products)
    if (status === "cancelled") {
      await restoreOrderVoucherUses(doc.orderID || doc._id);
    } else if (status === "delivered") {
      await burnConsumedVoucherUses(doc.orderID || doc._id);
    }

    // Realtime broadcast — targeted to user's personal room + admin room
    const io = req.app?.get("io");
    if (io) {
      const userId = doc.user && doc.user.userId ? String(doc.user.userId) : null;
      const payload = {
        orderID: String(doc.orderID ?? ""),
        sourceOrderID: String(doc.sourceOrderID ?? doc.orderID ?? ""),
        status,
        oldStatus,
        updatedAt: doc.trackingStatusUpdatedAt.toISOString(),
      };
      if (userId) io.to(`user-${userId}`).emit("order_status_updated", payload);
      io.to("admin").emit("order_status_updated", { ...payload, userId });
    }

    await logActivity({
      user: req.user,
      action: ACTIONS.ORDER_STATUS_CHANGED,
      description: `Changed main order ${doc.orderID || doc._id} status from "${oldStatus}" to "${status}"`,
      req,
      metadata: { orderId: String(doc._id), oldStatus, newStatus: status },
    });

    return res.status(200).json({ success: true, message: "Order status updated.", order: mapHistory(doc) });
  } catch (err) {
    console.error("updateTrackingStatus error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/tracked  (authenticated user)
// The customer's main-order tracking: everything that reached the main order
// CSV queue (confirmed, awaiting export) plus everything that was exported
// (OrderHistory archive). Status updates made by the admin are reflected here.
// ─────────────────────────────────────────────────────────────────────────────
const getMyTrackedOrders = async (req, res) => {
  try {
    const userId = String(req.user._id);
    const email = String(req.user.email || "").trim().toLowerCase();
    const userIdObj = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;

    const [history, queue] = await Promise.all([
      OrderHistory.find({
        $or: [
          { "user.userId": userId },
          ...(userIdObj ? [{ "user.userId": String(userIdObj) }] : []),
          ...(email ? [{ email }] : []),
        ],
      })
        .sort({ exportedAt: -1 })
        .lean(),
      MainOrderCSVData.find({
        $or: [
          ...(userIdObj ? [{ user: userIdObj }] : []),
          { user: userId },
          ...(email ? [{ userEmail: email }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const orders = [...history.map(mapHistory), ...queue.map(mapQueue)].sort(
      (a, b) => new Date(b.exportedAt || 0).getTime() - new Date(a.exportedAt || 0).getTime(),
    );

    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error("getMyTrackedOrders error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch tracked orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/tracked/:id/cancel  (authenticated user)
// User-initiated order cancellation. Works on both OrderHistory (exported)
// and MainOrderCSVData (queue) records. Only allowed for pending/confirmed
// orders that haven't been shipped yet.
// ─────────────────────────────────────────────────────────────────────────────
const cancelMyOrder = async (req, res) => {
  try {
    const userId = String(req.user._id);
    const email = String(req.user.email || "").trim().toLowerCase();
    const { reason } = req.body || {};
    const id = req.params.id;

    // Try OrderHistory first
    let doc = await OrderHistory.findById(id);
    let source = "history";

    if (!doc) {
      doc = await MainOrderCSVData.findById(id);
      source = "queue";
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Ownership check
    let isOwner = false;
    if (source === "history") {
      const orderUserId = doc.user ? String(doc.user.userId || doc.user) : "";
      const userIdObj = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
      isOwner = orderUserId === userId || (userIdObj && orderUserId === String(userIdObj)) || String(doc.email || "").trim().toLowerCase() === email;
    } else {
      const orderUserId = doc.user ? String(doc.user) : "";
      const userIdObj = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
      isOwner = orderUserId === userId || (userIdObj && String(userIdObj) === orderUserId) || String(doc.userEmail || "").trim().toLowerCase() === email;
    }

    if (!isOwner) {
      return res.status(403).json({ success: false, message: "This order does not belong to you." });
    }

    // Check current status — only pending/confirmed can be cancelled
    const currentStatus = source === "history" ? (doc.trackingStatus || "pending") : "pending";
    if (["shipped", "delivered", "cancelled"].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: currentStatus === "cancelled" ? "Order is already cancelled." : `Order has been ${currentStatus} and cannot be cancelled.`,
      });
    }

    if (source === "history") {
      // Set trackingStatus to cancelled
      doc.trackingStatus = "cancelled";
      doc.trackingStatusUpdatedAt = new Date();
      await doc.save();

      // Restore voucher uses
      await restoreOrderVoucherUses(doc.orderID || doc._id);

      // Socket event — notify user + admin (targeted rooms)
      const io = req.app?.get("io");
      if (io) {
        const cancelPayload = {
          orderID: String(doc.orderID || ""),
          totalAmount: doc.sellPrice || 0,
          cancelledBy: "user",
        };
        io.to(`user-${userId}`).emit("order_cancelled", cancelPayload);
        io.to("admin").emit("order_cancelled", { ...cancelPayload, userId });
        io.to(`user-${userId}`).emit("order_status_updated", {
          orderID: String(doc.orderID || ""),
          sourceOrderID: String(doc.sourceOrderID || doc.orderID || ""),
          status: "cancelled",
          oldStatus: currentStatus,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      // MainOrderCSVData — delete and archive to CancelOrder
      const cancelData = {
        user: doc.user || undefined,
        order: undefined,
        items: [],
        totalAmount: doc.sellPrice || 0,
        name: doc.name || "",
        address: doc.address || "",
        shpType: doc.shpType || "Regular",
        courierCompany: doc.courierCompany || "",
        courierCity: doc.courierCity || "",
        phoneNumber: doc.phoneNumber || "",
        phoneNumber2: doc.phoneNumber2 || "",
        sellPrice: doc.sellPrice || 0,
        businessProfiles: doc.businessProfiles || 1,
        courierInstruction: doc.courierInstruction || "",
        email: doc.email || doc.userEmail || "",
        shipping: doc.shipping || "cod",
        allowToOpen: doc.allowToOpen || "",
        cancelledAt: new Date(),
        cancelReason: reason || "Cancelled by user.",
        cancelReasonCategory: "user_cancelled",
      };

      // Normalize items from numbered columns
      const count = Math.max(0, Number(doc.productCount) || 0);
      for (let i = 1; i <= count; i++) {
        const name = String(doc[`productName${i}`] || "");
        if (!name) continue;
        cancelData.items.push({
          name,
          price: Number(doc[`productPrice${i}`] || 0),
          quantity: Number(doc[`qty${i}`] || 1),
          imageUrl: String(doc[`productImageUrl${i}`] || ""),
        });
      }

      await CancelOrder.create(cancelData);
      await MainOrderCSVData.deleteOne({ _id: doc._id });
      await restoreOrderVoucherUses(doc.orderID || doc._id);

      // Socket event — notify user + admin (targeted rooms)
      const io = req.app?.get("io");
      if (io) {
        const cancelPayload = {
          orderID: String(doc.orderID || ""),
          totalAmount: doc.sellPrice || 0,
          cancelledBy: "user",
        };
        io.to(`user-${userId}`).emit("order_cancelled", cancelPayload);
        io.to("admin").emit("order_cancelled", { ...cancelPayload, userId });
      }
    }

    // Send cancellation email
    try {
      const orderName = doc.name || req.user.name || "";
      await sendOrderCancelledByUserEmail(email, orderName, { orderID: doc.orderID, sellPrice: doc.sellPrice });
    } catch (emailErr) {
      console.error("[Cancel] Failed to send cancellation email:", emailErr);
    }

    // Log activity
    await logActivity({
      user: req.user,
      action: ACTIONS.ORDER_STATUS_CHANGED,
      description: `User cancelled order ${doc.orderID || doc._id}`,
      req,
      metadata: { orderId: String(doc._id), source, reason: reason || "" },
    });

    return res.json({ success: true, message: "Order cancelled successfully." });
  } catch (err) {
    console.error("cancelMyOrder error:", err);
    return res.status(500).json({ success: false, message: "Failed to cancel order." });
  }
};

module.exports = {
  getMainOrderStatusList,
  updateTrackingStatus,
  getMyTrackedOrders,
  cancelMyOrder,
};