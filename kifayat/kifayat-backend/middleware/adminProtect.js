const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!ADMIN_EMAILS.includes(req.user.email.toLowerCase())) {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required — email not in authorized list." });
  }
  next();
};

module.exports = { requireAdmin };
