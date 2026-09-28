/**
 * Voucher use lifecycle helpers (shared by voucher, order and workflow
 * controllers):
 *
 *  - apply            -> creates a "reserved" use (applied to a product)
 *  - order placed     -> reserved use becomes "consumed" (tied to an order)
 *  - order cancelled  -> consumed use is released back to the user
 *  - order failed     -> claimed uses are released back to the user
 */

const PurchasedVoucher = require("../models/PurchasedVoucher");

/**
 * Recompute the legacy `used` flag from the claimed use count.
 * A voucher is "used" when no available uses remain.
 * Returns the number of available uses.
 */
function recomputeVoucherUsed(pv) {
  const available = Math.max(0, (pv.total_uses || 1) - (pv.applied_products || []).length);
  if (available <= 0) {
    pv.used = true;
    if (!pv.used_at) pv.used_at = new Date();
  } else {
    pv.used = false;
    pv.used_at = null;
  }
  return available;
}

/**
 * Convert reserved uses into permanently consumed uses after an order is
 * successfully placed. `conversions` = [{ pvId, productId }].
 */
async function convertReservationsToConsumed(orderId, conversions = []) {
  for (const { pvId, productId } of conversions) {
    const pv = await PurchasedVoucher.findById(pvId);
    if (!pv) continue;
    const entry = (pv.applied_products || []).find(
      (a) => a.status === "reserved" && String(a.product) === String(productId)
    );
    if (!entry) continue;
    entry.status = "consumed";
    entry.order = orderId;
    recomputeVoucherUsed(pv);
    await pv.save();
  }
  if (conversions.length) {
    console.log(`[Voucher] Converted ${conversions.length} reserved use(s) to consumed for order ${String(orderId)}.`);
  }
}

/**
 * Release claimed uses (reserved or consumed) for a failed order attempt.
 * The user gets those uses back immediately.
 */
async function releaseClaimedUses(conversions = []) {
  for (const { pvId, productId } of conversions) {
    const pv = await PurchasedVoucher.findById(pvId);
    if (!pv) continue;
    const before = pv.applied_products.length;
    pv.applied_products = (pv.applied_products || []).filter(
      (a) => String(a.product) !== String(productId)
    );
    if (pv.applied_products.length !== before) {
      recomputeVoucherUsed(pv);
      await pv.save();
    }
  }
  if (conversions.length) {
    console.log(`[Voucher] Released ${conversions.length} claimed use(s) after failed order attempt.`);
  }
}

/**
 * Restore every consumed use tied to an order that has been cancelled,
 * rejected, refunded, failed or never delivered. Runs automatically from
 * every cancellation path — no manual intervention required.
 */
async function restoreOrderVoucherUses(orderId) {
  const oid = String(orderId);
  const docs = await PurchasedVoucher.find({ "applied_products.order": orderId });
  for (const pv of docs) {
    const before = pv.applied_products.length;
    pv.applied_products = (pv.applied_products || []).filter(
      (a) => String(a.order) !== oid
    );
    if (pv.applied_products.length !== before) {
      recomputeVoucherUsed(pv);
      await pv.save();
    }
  }
  if (docs.length) {
    console.log(`[Voucher] Restored voucher use(s) for cancelled order ${oid} (${docs.length} voucher(s)).`);
  }
}

/**
 * Release every reserved use on the given products for a user. Used when an
 * order attempt failed before some items were reached in the pricing loop
 * (e.g. a stock error) — those reservations were never claimed by the order,
 * so the user gets them back immediately.
 */
async function releaseReservedForProducts(userId, productIds = []) {
  const ids = [...new Set(productIds.map(String))].filter(Boolean);
  if (!ids.length) return 0;
  const docs = await PurchasedVoucher.find({
    user: userId,
    "applied_products.status": "reserved",
    "applied_products.product": { $in: ids },
  });
  let released = 0;
  for (const pv of docs) {
    const before = pv.applied_products.length;
    pv.applied_products = (pv.applied_products || []).filter(
      (a) => !(a.status === "reserved" && ids.includes(String(a.product)))
    );
    if (pv.applied_products.length !== before) {
      recomputeVoucherUsed(pv);
      await pv.save();
      released++;
    }
  }
  if (released) {
    console.log(`[Voucher] Released ${released} reserved use(s) for user ${String(userId)} after failed order attempt.`);
  }
  return released;
}

/**
 * Burn (permanently remove) every consumed use tied to a delivered/completed
 * order. A delivered order ends the voucher's job on that product — and
 * without this, the consumed entry would keep counting toward total_uses and
 * permanently lock the voucher's remaining uses (and the product) for the
 * user. Called automatically when an order reaches a terminal success state.
 */
async function burnConsumedVoucherUses(orderId) {
  const oid = String(orderId);
  const docs = await PurchasedVoucher.find({ "applied_products.order": orderId });
  for (const pv of docs) {
    const before = pv.applied_products.length;
    pv.applied_products = (pv.applied_products || []).filter(
      (a) => String(a.order) !== oid
    );
    if (pv.applied_products.length !== before) {
      recomputeVoucherUsed(pv);
      await pv.save();
    }
  }
  if (docs.length) {
    console.log(`[Voucher] Burned consumed use(s) for delivered order ${oid} (${docs.length} voucher(s)).`);
  }
}

module.exports = {
  recomputeVoucherUsed,
  convertReservationsToConsumed,
  releaseClaimedUses,
  restoreOrderVoucherUses,
  releaseReservedForProducts,
  burnConsumedVoucherUses,
};
