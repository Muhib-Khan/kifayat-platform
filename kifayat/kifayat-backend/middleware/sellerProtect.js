const { protect } = require("./auth");

const requireSeller = [
  protect,
  (req, res, next) => {
    if (!req.user || req.user.role !== "seller") {
      return res.status(403).json({ success: false, message: "Seller access required." });
    }
    next();
  },
];

module.exports = { requireSeller };