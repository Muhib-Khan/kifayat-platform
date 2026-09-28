const mongoose = require("mongoose");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const CancelOrder = require("../models/CancelOrder");
const User = require("../models/User");
const { restoreOrderVoucherUses } = require("./voucherLifecycle");
const { sendInsufficientStockEmail } = require("./email");

// ─────────────────────────────────────────────────────────────────────────────
// Automatic cancellation of confirmed main-order records that can no longer be
// fulfilled because a product in them is permanently out of stock.
//
// This is the shared engine behind the admin "stock exhaustion" endpoint and
// the automatic safeguard that fires when a product is deleted from the
// catalog (HHC sync purge / out-of-stock timer). It removes the order from the
// shipping queue, archives it to cancel_orders, restores any voucher uses, and
// emails the customer the honest "cannot be fulfilled" notice.
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the customer of a main order without a PreOrder (user ref or email). */
async function resolveMainOrderUser(mainOrder = {}) {
  const { user, userEmail } = mainOrder;
  if (user && mongoose.isValidObjectId(user)) {
    const u = await User.findById(user).select("_id email name").lean();
    if (u) return u;
  }
  const email = String(userEmail || mainOrder.email || "").trim().toLowerCase();
  if (email) {
    const u = await User.findOne({ email }).select("_id email name").lean();
    if (u) return u;
  }
  return null;
}

/**
 * Rebuild a CancelOrder items array from the numbered MainOrderCSVData fields.
 * `product` only carries a real Mongo ObjectId ref when available — SKUs and
 * HHC ids would fail the CancelOrder ObjectId cast, so they are dropped and the
 * archived line keeps its denormalized name/price/qty instead.
 */
function mainOrderItems(mainOrder = {}) {
  const items = [];
  const count = Number(mainOrder.productCount) || 0;
  for (let i = 1; i <= count; i++) {
    const ref = mainOrder[`productId${i}`] || mainOrder[`product${i}`] || "";
    items.push({
      product: mongoose.isValidObjectId(ref) ? ref : undefined,
      name: mainOrder[`productName${i}`] || "",
      quantity: Number(mainOrder[`qty${i}`]) || 0,
      price:
        mainOrder[`productPrice${i}`] !== undefined &&
        mainOrder[`productPrice${i}`] !== null
          ? Number(mainOrder[`productPrice${i}`])
          : 0,
      imageUrl: "",
    });
  }
  return items;
}

/**
 * Cancel one confirmed main-order record for a permanent stock issue.
 *
 * @param {object} mainOrder  the lean MainOrderCSVData document
 * @param {string} orderId    the main-order id (= mainOrder.orderID)
 * @returns {{cancelled: boolean, skipped?: string, cancelOrderId?: string}}
 */
async function cancelMainOrderForStockIssue({ mainOrder, orderId }) {
  if (!mainOrder) return { cancelled: false, skipped: "not_found" };
  if (mainOrder.hhcStatus === "assigned") {
    // Already sent to HHC — out of scope for automatic cancellation.
    return { cancelled: false, skipped: "assigned" };
  }

  await MainOrderCSVData.deleteOne({ orderID: orderId });

  const user = await resolveMainOrderUser(mainOrder);
  const items = mainOrderItems(mainOrder);

  const cancelOrder = await CancelOrder.create({
    user: user?._id || null,
    order: mongoose.isValidObjectId(orderId) ? orderId : undefined,
    originalPreOrderId: null,
    items,
    totalAmount: mainOrder.sellPrice || mainOrder.totalAmount || 0,
    name: mainOrder.name,
    address: mainOrder.address,
    shpType: mainOrder.shpType,
    courierCompany: mainOrder.courierCompany,
    courierCity: mainOrder.courierCity,
    phoneNumber: mainOrder.phoneNumber,
    phoneNumber2: mainOrder.phoneNumber2,
    sellPrice: mainOrder.sellPrice,
    businessProfiles: mainOrder.businessProfiles,
    courierInstruction: mainOrder.courierInstruction,
    email: mainOrder.email,
    shipping: mainOrder.shipping,
    allowToOpen: mainOrder.allowToOpen,
    cancelledAt: new Date(),
    cancelReason: "Product permanently out of stock — order cannot be fulfilled.",
    cancelReasonCategory: "insufficient_stock",
  });

  // Give back any voucher uses consumed by this order.
  await restoreOrderVoucherUses(orderId).catch((err) =>
    console.error("[Auto-cancel] Failed to restore voucher uses:", err),
  );

  // Honest customer notice.
  try {
    await sendInsufficientStockEmail(
      String(mainOrder.email || ""),
      mainOrder.name || "",
      { _id: orderId },
    );
  } catch (err) {
    console.error("[Auto-cancel] Failed to send insufficient-stock email:", err);
  }

  console.log(
    `[Auto-cancel] Order ${orderId} — permanently out of stock, removed from main orders and archived to cancel_orders.`,
  );

  return { cancelled: true, cancelOrderId: cancelOrder._id };
}

module.exports = { cancelMainOrderForStockIssue, resolveMainOrderUser, mainOrderItems };