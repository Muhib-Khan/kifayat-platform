const express = require("express");
const { downloadMainCSV, getCSVQueueCount, downloadPreOrderCSV } = require("../controllers/csvExportController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

router.use(protect, requireAdmin);

// GET /api/admin/export-csv/count  — non-destructive queue size check
router.get("/count", getCSVQueueCount);

// GET /api/admin/export-csv  — download + archive + delete
router.get("/", downloadMainCSV);

// GET /api/admin/export-csv/preorders  — non-destructive pre-order snapshot
router.get("/preorders", downloadPreOrderCSV);

// POST /api/admin/export-csv/move-preorder/:id  — move a stuck PreOrder to MainOrderCSVData
router.post("/move-preorder/:id", async (req, res) => {
  try {
    const { movePreOrderToCSV } = require("../controllers/csvExportController");
    return await movePreOrderToCSV(req, res);
  } catch (err) {
    console.error("move-preorder route error:", err);
    return res.status(500).json({ success: false, message: "Failed to move pre-order." });
  }
});

module.exports = router;
