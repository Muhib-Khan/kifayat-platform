const express      = require("express");
const router       = express.Router();
const { protect }  = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const {
  getAdminSettings,
  addGroqKey,
  updateGroqKeyById,
  deleteGroqKeyById,
  testGroqKeyById,
  updateDeliveryFee,
  updateGlobalPricing,
  updateHeroObjects,
  // legacy
  updateGroqKey,
  deleteGroqKey,
  testGroqKey,
} = require("../controllers/settingsController");

router.use(protect, requireAdmin);

router.get("/", getAdminSettings);
router.put("/delivery-fee", updateDeliveryFee);
router.put("/global-pricing", updateGlobalPricing);
router.put("/hero-objects", updateHeroObjects);

// ── Multi-key endpoints ───────────────────────────────────────────────────────
router.post("/groq-keys",          addGroqKey);
router.put( "/groq-keys/:id",      updateGroqKeyById);
router.delete("/groq-keys/:id",    deleteGroqKeyById);
router.post("/groq-keys/:id/test", testGroqKeyById);

// ── Legacy single-key endpoints (kept for compat) ────────────────────────────
router.put("/groq-key",       updateGroqKey);
router.delete("/groq-key",    deleteGroqKey);
router.post("/groq-key/test", testGroqKey);

module.exports = router;
