const express = require("express");
const {
  runDiagnostic,
  getLatestDiagnostic,
  setProductPrice,
  confirmDiagnostic,
  resolveDiagnostic,
} = require("../controllers/diagnosticController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

// Public confirm endpoint (clicked from email — no auth)
router.get("/confirm/:token", confirmDiagnostic);

// Admin-only
router.post("/price", protect, requireAdmin, runDiagnostic);
router.get("/latest", protect, requireAdmin, getLatestDiagnostic);
router.post("/price/set", protect, requireAdmin, setProductPrice);
router.post("/resolve", protect, requireAdmin, resolveDiagnostic);

module.exports = router;
