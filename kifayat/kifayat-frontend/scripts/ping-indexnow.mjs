// ─── IndexNow ping ──────────────────────────────────────────────────────────
// Runs AFTER generate-sitemaps.mjs (which writes fresh sitemaps to public/).
// Tells Bing + Yandex + Seznam "the sitemap changed" so new/updated product
// pages get crawled in hours instead of weeks. The key file
// (public/<INDEXNOW_KEY>.txt) is served at https://www.kifayat.co/<key>.txt,
// which is how IndexNow verifies ownership.
//
// Resilience: this script NEVER throws — a failed ping must not break deploys.

import { SITE_URL } from "./seo-config.mjs";

const INDEXNOW_KEY = "29c2fab74b0811e389ffb738e6e91c4c";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

async function pingIndexNow() {
  const url = `${INDEXNOW_ENDPOINT}?url=${encodeURIComponent(SITEMAP_URL)}&key=${INDEXNOW_KEY}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
    // 200 = submitted, 202 = accepted, 403 = key invalid, 422 = bad URL
    console.log(
      `[indexnow] ${SITEMAP_URL} -> HTTP ${res.status} ${res.statusText}`,
    );
    if (res.status === 403) {
      console.warn(
        "[indexnow] 403 — key file not reachable at https://www.kifayat.co/" +
          INDEXNOW_KEY +
          ".txt — check public/ deployment.",
      );
    }
  } catch (err) {
    console.warn(`[indexnow] ping failed (non-fatal): ${err.message}`);
  }
}

pingIndexNow();