// Blocks cross-site state-changing requests (CSRF defense) on admin endpoints.
// Modern browsers send Sec-Fetch-Site on every request; it cannot be spoofed
// by a plain <form> cross-site POST. Legacy/non-browser clients may omit it,
// so absence is allowed (not a regression risk).
const BLOCKED_SITES = new Set(["cross-site"]);
const ALLOWED_SITES = new Set(["same-origin", "same-site", "none"]);
module.exports = function requireSameOrigin(req, res, next) {
  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string" && BLOCKED_SITES.has(fetchSite.toLowerCase())) {
    return res.status(403).json({ success: false, message: "Blocked cross-site request" });
  }
  next();
};
