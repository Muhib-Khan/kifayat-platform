const express = require("express");
const { generateUserFinalData, getUserFinalData } = require("../controllers/userFinalDataController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminProtect");

const router = express.Router();

router.use(protect, requireAdmin);

router.post("/generate", generateUserFinalData);
router.get("/", getUserFinalData);

module.exports = router;
