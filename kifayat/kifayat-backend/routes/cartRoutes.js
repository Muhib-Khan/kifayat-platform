const express = require("express");
const { getCart, saveCart, validateCart } = require("../controllers/cartController");
const { protect } = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");

const router = express.Router();

router.get("/", protect, getCart);
router.post("/", protect, saveCart);
router.post("/validate", protect, validateCart);

module.exports = router;
