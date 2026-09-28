const mongoose = require("mongoose");
const Product = require("../models/Product");
const OutOfStockDeletedProduct = require("../models/OutOfStockDeletedProduct");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const OrderHistory = require("../models/OrderHistory");
const { cancelMainOrderForStockIssue } = require("./mainOrderCancellation");

const timers = new Map();

function scheduleDeletion(productId, io) {
  cancelDeletion(productId);
  const id = productId.toString();
  const TWO_MIN = 2 * 60 * 1000;

  const timeout = setTimeout(async () => {
    try {
      const product = await Product.findById(id);
      if (!product) {
        timers.delete(id);
        return;
      }
      await executeDeletion(product, io);
    } catch (err) {
      console.error("Out-of-stock deletion failed:", err);
    } finally {
      timers.delete(id);
    }
  }, TWO_MIN);

  timers.set(id, timeout);
}

function cancelDeletion(productId) {
  const id = productId.toString();
  const timeout = timers.get(id);
  if (timeout) {
    clearTimeout(timeout);
    timers.delete(id);
  }
}

async function restorePendingOnStartup(io) {
  const now = new Date();
  // Products whose deletion deadline has already passed — delete immediately
  const expired = await Product.find({
    pendingDeleteAt: { $ne: null, $lte: now },
  });
  for (const p of expired) {
    await executeDeletion(p, io);
  }
  // Products still within their 2-minute window — schedule fresh timers
  const pending = await Product.find({
    pendingDeleteAt: { $ne: null, $gt: now },
  });
  for (const p of pending) {
    scheduleDeletion(p._id, io);
  }
  const total = expired.length + pending.length;
  if (total > 0) {
    console.log(`Restored ${total} out-of-stock deletion timers (${expired.length} immediate, ${pending.length} scheduled)`);
  }
}

// ── Customer-facing stock alerts ───────────────────────────────────────────
// When a product is removed because it went out of stock (or vanished from
// HHC during a sync), confirmed orders still sitting in the Main Order queue
// can no longer be fulfilled — those are AUTO-CANCELLED: removed from the
// shipping queue, archived to cancel_orders with the customer's details and
// items, their voucher uses restored, and the customer emailed an honest
// "cannot be fulfilled" notice. Orders already exported to HHC (OrderHistory)
// are left alone and only get a persisted stock alert.
async function notifyStockAlertCustomers(products, io) {
  const list = Array.isArray(products) ? products : [products];
  const tokens = [];
  const byToken = new Map();
  for (const p of list) {
    if (!p) continue;
    const info = {
      productId: String(p.productId ?? ""),
      sku: String(p.sku ?? ""),
      productName: String(p.name ?? ""),
    };
    for (const t of [
      String(p.productId ?? "").trim().toLowerCase(),
      String(p.sku ?? "").trim().toLowerCase(),
      String(p.name ?? "").trim().toLowerCase(),
    ]) {
      if (!t) continue;
      if (!byToken.has(t)) {
        byToken.set(t, info);
        tokens.push(t);
      }
    }
  }
  if (tokens.length === 0) return 0;

  let notified = 0;
  const cancelledOrderIds = new Set();

  // Orders still in the shipping queue can't be fulfilled — cancel them.
  const queueMatches = await MainOrderCSVData.find({
    productSearch: { $in: tokens },
  }).lean();
  for (const doc of queueMatches) {
    const search = Array.isArray(doc.productSearch) ? doc.productSearch : [];
    const hitToken = search.find((t) => byToken.has(t));
    if (!hitToken) continue;
    const info = byToken.get(hitToken);
    const orderId = String(doc.orderID || doc._id || "");
    if (!orderId || cancelledOrderIds.has(orderId)) continue;

    const result = await cancelMainOrderForStockIssue({ mainOrder: doc, orderId }).catch(
      (err) => {
        console.error("Auto-cancel failed for out-of-stock order:", err);
        return null;
      },
    );
    if (!result?.cancelled) continue;

    cancelledOrderIds.add(orderId);
    notified++;

    if (io) {
      const userId =
        doc.user && typeof doc.user === "object" && doc.user.userId
          ? String(doc.user.userId)
          : mongoose.isValidObjectId(doc.user)
            ? String(doc.user)
            : null;
      const email = String(doc.email || doc.userEmail || "").trim().toLowerCase();
      io.emit("order_product_out_of_stock", {
        userId,
        email,
        orderID: orderId,
        sourceOrderID: String(doc.sourceOrderID || doc.orderID || ""),
        productId: info.productId,
        productName: info.productName,
        cancelled: true,
        notifiedAt: new Date().toISOString(),
      });
    }
  }

  // Already-exported orders (OrderHistory) can't be cancelled here — they have
  // shipped instructions. Persist the alert so "Your Orders" surfaces it.
  const historyMatches = await OrderHistory.find({
    productSearch: { $in: tokens },
  }).lean();
  for (const doc of historyMatches) {
    const search = Array.isArray(doc.productSearch) ? doc.productSearch : [];
    const hitToken = search.find((t) => byToken.has(t));
    if (!hitToken) continue;
    const info = byToken.get(hitToken);

    const already = await OrderHistory.exists({
      _id: doc._id,
      "stockAlerts.productId": info.productId,
    });
    if (!already) {
      await OrderHistory.updateOne(
        { _id: doc._id },
        {
          $push: {
            stockAlerts: {
              productId: info.productId,
              productName: info.productName,
              sku: info.sku,
              notifiedAt: new Date(),
            },
          },
        },
      );
    }
    notified++;

    if (io) {
      const userId =
        doc.user && typeof doc.user === "object" && doc.user.userId
          ? String(doc.user.userId)
          : mongoose.isValidObjectId(doc.user)
            ? String(doc.user)
            : null;
      const email = String(doc.email || doc.userEmail || "").trim().toLowerCase();
      io.emit("order_product_out_of_stock", {
        userId,
        email,
        orderID: String(doc.orderID || ""),
        sourceOrderID: String(doc.sourceOrderID || doc.orderID || ""),
        productId: info.productId,
        productName: info.productName,
        cancelled: false,
        notifiedAt: new Date().toISOString(),
      });
    }
  }

  return notified;
}

async function executeDeletion(product, io, opts = {}) {
  const { suppressSocket = false } = opts;
  try {
    const id = product._id.toString();
    if (product.stock > 0) {
      product.pendingDeleteAt = null;
      await product.save();
      return;
    }
    const obj = product.toObject();
    delete obj._id;
    delete obj.__v;
    delete obj.pendingDeleteAt;

    await OutOfStockDeletedProduct.create({
      originalProductId: product._id,
      ...obj,
      deletedAt: new Date(),
      deletedBecause: "out_of_stock",
    });

    await Product.deleteOne({ _id: id });

    // Notify customers who have a confirmed order containing this product.
    await notifyStockAlertCustomers(product, io).catch((err) =>
      console.error("Stock alert notification failed:", err),
    );

    if (io && !suppressSocket) {
      io.emit("product_deleted", { productId: id });
    }
  } catch (err) {
    console.error("Immediate out-of-stock deletion failed:", err);
  }
}

async function deleteAllOutOfStock(io, opts = {}) {
  const outOfStock = await Product.find({ stock: { $lte: 0 } });
  let deleted = 0;
  for (const product of outOfStock) {
    await executeDeletion(product, io, opts);
    deleted++;
  }
  if (deleted > 0 && io) {
    io.emit("products_updated", { source: "out-of-stock-cleanup", deleted });
  }
  return deleted;
}

module.exports = {
  scheduleDeletion,
  cancelDeletion,
  restorePendingOnStartup,
  deleteAllOutOfStock,
  notifyStockAlertCustomers,
};
