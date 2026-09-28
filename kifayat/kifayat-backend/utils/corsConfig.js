// Explicit CORS origin allowlist. Do not add wildcard domains here —
// production origins belong in the CORS_ORIGINS env var (comma-separated).
// Env URLs are normalized (apex -> www) via utils/appUrl.js so stale or
// missing config cannot lock the canonical storefront out.
const { normalizeAppUrl } = require("./appUrl");

const getAllowedOrigins = () => {
  const origins = new Set([
    normalizeAppUrl(process.env.FRONTEND_URL || "http://localhost:5000"),
    "http://localhost:5000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:10192",
    // Canonical storefront host + Vercel deployment (always allowed).
    "https://www.kifayat.co",
    "https://kifayat-jet.vercel.app",
  ]);
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => normalizeAppUrl(o.trim()))
    .filter(Boolean)
    .forEach((o) => origins.add(o));
  return [...origins];
};

const isOriginAllowed = (origin) => {
  if (!origin) return true; // non-browser clients (curl, health checks)
  if (getAllowedOrigins().includes(origin)) return true;
  // Legacy/defensive: the apex (https://kifayat.co) 308-redirects to www in
  // browsers, so its Origin is rarely seen — but direct API clients may still
  // send it. Exact matches only — no wildcards.
  return origin === "https://kifayat.co";
};

module.exports = { getAllowedOrigins, isOriginAllowed };
