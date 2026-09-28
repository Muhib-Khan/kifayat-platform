const express = require("express");
const {
  confirmPreOrderWithThreshold,
  assignToHHC,
  handleStockExhaustion,
  cancelPreOrderByUser,
  getLateConfirmations,
  getCancelOrders,
  removeLowStockOrder,
  getLowStockOrders,
} = require("../controllers/orderWorkflowController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");

const router = express.Router();

// Public — confirm pre-order with stock threshold check
router.get("/confirm-preorder/:token", confirmPreOrderWithThreshold);

// Public — cancel pre-order by user
router.get("/cancel-preorder/:token", cancelPreOrderByUser);

// Admin — assign order to HHC (with final stock check)
router.post("/assign-hhc/:orderId", protect, requireAdmin, requireSameOrigin, assignToHHC);

// Admin — handle stock exhaustion after main order entry
router.post("/stock-exhaustion/:orderId", protect, requireAdmin, requireSameOrigin, handleStockExhaustion);

// Admin — list late confirmation orders
router.get("/late-confirmations", protect, requireAdmin, getLateConfirmations);

// Admin — remove order from main_orders if stock < 50 (triggers email)
router.post("/remove-low-stock/:orderId", protect, requireAdmin, requireSameOrigin, removeLowStockOrder);

// Admin — list main_orders with stock below threshold
router.get("/low-stock-orders", protect, requireAdmin, getLowStockOrders);

// Admin — list cancel orders
router.get("/cancel-orders", protect, requireAdmin, getCancelOrders);

module.exports = router;
