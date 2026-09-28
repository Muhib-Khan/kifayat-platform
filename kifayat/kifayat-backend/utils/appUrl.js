// ─── App URL resolver ────────────────────────────────────────────────────────
// Single source of truth for the production storefront URL used in emails,
// CORS, and diagnostics. Env values are normalized so stale/missing config can
// never produce wrong links: the apex (https://kifayat.co) is mapped to the
// canonical www host (Vercel 308-redirects apex -> www).

const CANONICAL_URL = "https://www.kifayat.co";

/** Normalize an app URL: trim, drop trailing slash, and map the apex to www. */
function normalizeAppUrl(value) {
  if (!value) return CANONICAL_URL;
  const cleaned = String(value).trim().replace(/\/+$/, "");
  if (/^https?:\/\/kifayat\.co$/i.test(cleaned)) return CANONICAL_URL;
  return cleaned;
}

/**
 * Resolve the app URL from env vars (PUBLIC_APP_URL > SITE_URL > FRONTEND_URL).
 * Missing or apex values fall back to the canonical www host.
 */
function getAppUrl() {
  return normalizeAppUrl(
    process.env.PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      process.env.FRONTEND_URL,
  );
}

module.exports = { CANONICAL_URL, normalizeAppUrl, getAppUrl };