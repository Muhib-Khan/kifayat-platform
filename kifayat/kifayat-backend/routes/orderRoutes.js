const express = require("express");
const { placeOrder,
  getMyOrders,
  getAllOrders,
  getAllPreOrders,
  updateOrderStatus,
  sendShippingOTP,
  verifyShippingOTP,
  finalizeOrder,
  confirmOrder,
  cancelOrder,
  getOrderByClientRequestId,
  getPublicOrderCount,
  resendOrderConfirmation,
} = require("../controllers/orderController");
const { getMyTrackedOrders, cancelMyOrder } = require("../controllers/orderTrackingController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const { tokenLinkLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// Public — confirm/cancel order via emailed link (no auth required, rate-limited)
router.get("/confirm/:token", tokenLinkLimiter, confirmOrder);
router.get("/cancel/:token", tokenLinkLimiter, cancelOrder);

// Public — storefront trust proof: how many orders Kifayat has placed total
router.get("/count", getPublicOrderCount);

// Authenticated users — shipping email OTP
router.post("/shipping-otp", protect, sendShippingOTP);
router.post("/verify-shipping-otp", protect, verifyShippingOTP);

// Authenticated users — place order & view own orders
router.post("/", protect, placeOrder);
// Documented alias for clients using the original checkout endpoint.
router.post("/place", protect, placeOrder);
router.get("/my", protect, getMyOrders);

// Main-order tracking for the customer ("Your Orders") — sourced from the
// main order CSV queue + the exported OrderHistory archive.
router.get("/tracked", protect, getMyTrackedOrders);
router.post("/tracked/:id/cancel", protect, cancelMyOrder);
router.post("/resend-confirmation/:orderNumber", protect, resendOrderConfirmation);

// Recovery check — did the order for a client request actually get created?
router.get("/by-request/:clientRequestId", protect, getOrderByClientRequestId);

// Admin only — view all orders, pre-orders & update status
router.get("/preorders", protect, requireAdmin, getAllPreOrders);
router.get("/", protect, requireAdmin, getAllOrders);
router.patch("/:id/status", protect, requireAdmin, updateOrderStatus);
router.put("/:id/status", protect, requireAdmin, updateOrderStatus);

// Finalize expired pre-order (move to MainOrderCSVData)
router.post("/finalize/:id", protect, requireAdmin, finalizeOrder);

module.exports = router;
