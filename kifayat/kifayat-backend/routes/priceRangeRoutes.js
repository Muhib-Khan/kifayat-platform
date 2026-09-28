const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");
const requireSameOrigin = require("../middleware/originGuard");
const { getPriceRanges, createPriceRange, deletePriceRange, getPriceRangeProducts } = require("../controllers/priceRangeController");

router.use(protect, requireAdmin, requireSameOrigin);

router.get("/", getPriceRanges);
router.get("/:id/products", getPriceRangeProducts);
router.post("/", createPriceRange);
router.delete("/:id", deletePriceRange);

module.exports = router;
