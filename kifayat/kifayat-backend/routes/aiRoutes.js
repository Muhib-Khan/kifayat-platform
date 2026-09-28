const express      = require("express");
const router       = express.Router();
const { protect }  = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const {
  startDescriptionDoctor, getDescriptionDoctorStatus,
  startTitleOptimizer,    getTitleOptimizerStatus,
  analyzeReviews,
  findDuplicates,
  startSeoBooster,        getSeoBoosterStatus,
  analyzePricing,
  startCategoryFixer,     getCategoryFixerStatus,
  hideProduct,
  poolStatus,
} = require("../controllers/aiController");

router.use(protect, requireAdmin);

// Engine status (Gemini + Groq pools)
router.get("/pool-status", poolStatus);

// 1. Description Doctor
router.post("/description-doctor/start",  startDescriptionDoctor);
router.get( "/description-doctor/status", getDescriptionDoctorStatus);

// 2. Title Optimizer
router.post("/title-optimizer/start",  startTitleOptimizer);
router.get( "/title-optimizer/status", getTitleOptimizerStatus);

// 3. Review Intelligence
router.post("/review-intelligence", analyzeReviews);

// 4. Duplicate Radar
router.post("/duplicate-radar",    findDuplicates);

// 5. SEO Booster
router.post("/seo-booster/start",  startSeoBooster);
router.get( "/seo-booster/status", getSeoBoosterStatus);

// 6. Price Intelligence
router.post("/price-intelligence", analyzePricing);

// 7. Category Fixer
router.post("/category-fixer/start",  startCategoryFixer);
router.get( "/category-fixer/status", getCategoryFixerStatus);

// Utility
router.patch("/products/:id/hide", hideProduct);

module.exports = router;
