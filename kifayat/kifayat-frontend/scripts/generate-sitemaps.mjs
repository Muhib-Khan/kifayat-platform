// ─── Kifayat sitemap generator ──────────────────────────────────────────────
// Fetches the DB-driven sitemaps from the backend, normalizes every URL to
// the canonical host (https://www.kifayat.co), and writes them into public/
// so Vite copies them into dist/ and Vercel serves them statically before the
// catch-all rewrite.
//
// Backend cold-boot handling: each fetch retries up to 5 times with
// exponential backoff (2s, 4s, 8s, 16s, 32s) and a 30s per-attempt timeout.
// All five fetches run concurrently so wall-clock cost is bounded by the
// slowest single fetch. If the backend is unreachable the script falls back
// to a locally generated sitemap-pages.xml and an index pointing only at it.
//
// This script NEVER throws: a failed sitemap fetch must not break deploys.

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { BACKEND_URL, SITE_URL, STATIC_ROUTES, FRONTEND_ROOT } from "./seo-config.mjs";

const PUBLIC_DIR = path.join(FRONTEND_ROOT, "public");
const SUB_SITEMAPS = [
  "sitemap-pages.xml",
  "sitemap-products.xml",
  "sitemap-categories.xml",
  "image-sitemap.xml",
];
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000];
const ATTEMPT_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch a URL with up to 5 exponential-backoff retries (2s,4s,8s,16s,32s). */
async function fetchWithRetry(url) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        console.log(
          `[sitemaps] ${url} attempt ${attempt + 1} failed (${err.message}) — retrying in ${RETRY_DELAYS_MS[attempt] / 1000}s`,
        );
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  throw lastError;
}

const xmlEscape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Rewrite every URL to the canonical host:
 *   https://kifayat.co        -> https://www.kifayat.co
 *   http://...                -> https://www.kifayat.co
 *   //kifayat.co (protocol-relative) -> //www.kifayat.co
 *   https://www.kifayat.co    -> unchanged
 * URLs on other hosts (e.g. the CDN image URLs) are left untouched.
 */
function normalizeHosts(xml) {
  return xml
    .replace(/https?:\/\/(?:www\.)?kifayat\.co/gi, SITE_URL)
    .replace(/\/\/kifayat\.co/gi, SITE_URL.replace(/^https:/, ""));
}

/** Prefix bare relative <loc>/path</loc> entries with the canonical origin. */
function absolutizeLocs(xml) {
  return xml.replace(/(<loc>\s*)\/(?!\/)/gi, `$1${SITE_URL}/`);
}

/** Remove duplicate <url> blocks from a sitemap XML, keeping the first occurrence of each <loc>. */
function deduplicateSitemap(xml) {
  const seenLocs = new Set();
  return xml.replace(/<url>[\s\S]*?<\/url>/gi, (match) => {
    const locMatch = match.match(/<loc>([\s\S]*?)<\/loc>/);
    if (locMatch) {
      if (seenLocs.has(locMatch[1])) {
        return ""; // skip this duplicate <url> block
      }
      seenLocs.add(locMatch[1]);
    }
    return match;
  });
}
function buildLocalPagesSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  // Categories live in the DB-driven sitemap-categories.xml, so the pages
  // sitemap covers only static + blog routes.
  const entries = STATIC_ROUTES.filter((route) => !route.startsWith("/category/")).map((route) => {
    const priority = route === "/" ? 1.0 : route === "/products" ? 0.9 : route.startsWith("/blog/") ? 0.6 : 0.5;
    return [
      "  <url>",
      `    <loc>${SITE_URL}${xmlEscape(route)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      "    <changefreq>weekly</changefreq>",
      `    <priority>${priority.toFixed(1)}</priority>`,
      "  </url>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join("\n"),
    "</urlset>",
    "",
  ].join("\n");
}

/** Sitemap index listing the given sitemap files. */
function buildIndexSitemap(files) {
  const entries = [...files]
    .sort()
    .map((f) => `  <sitemap>\n    <loc>${SITE_URL}/${xmlEscape(f)}</loc>\n  </sitemap>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });

  const targets = [
    { file: "sitemap.xml", url: `${BACKEND_URL}/sitemap.xml`, label: "index" },
    ...SUB_SITEMAPS.map((file) => ({ file, url: `${BACKEND_URL}/${file}`, label: file })),
  ];

  // Fetch everything concurrently so a cold-booting backend costs one
  // backoff cycle in wall-clock, not five.
  const settled = await Promise.allSettled(targets.map((t) => fetchWithRetry(t.url)));

  const fetched = new Map(); // file -> normalized XML
  targets.forEach((t, i) => {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      fetched.set(t.file, deduplicateSitemap(absolutizeLocs(normalizeHosts(outcome.value))));
      console.log(`[sitemaps] OK   ${t.label} <- ${t.url}`);
    } else {
      console.warn(`[sitemaps] FAIL ${t.label} <- ${t.url}: ${outcome.reason.message}`);
    }
  });

  const backendReachable = fetched.size > 0;
  const written = new Set();

  // Pages sitemap is ALWAYS built locally from STATIC_ROUTES (derived from the
  // route files, blog-data.ts and shop-data.ts) so it stays in sync with the
  // source of truth — a new blog post or static route is indexed immediately
  // without needing a backend edit. The backend's hardcoded copy (fetched
  // above) is kept only as a fallback reference, never written to public/.
  const pagesXml = buildLocalPagesSitemap();
  await writeFile(path.join(PUBLIC_DIR, "sitemap-pages.xml"), pagesXml, "utf8");
  written.add("sitemap-pages.xml");
  console.log(`[sitemaps] sitemap-pages.xml built locally from STATIC_ROUTES (${STATIC_ROUTES.length} routes)`);

  // Write the remaining sub-sitemaps; remove stale copies so dist never ships
  // outdated sitemaps that the new index no longer references.
  for (const file of SUB_SITEMAPS.filter((f) => f !== "sitemap-pages.xml")) {
    if (fetched.has(file)) {
      await writeFile(path.join(PUBLIC_DIR, file), fetched.get(file), "utf8");
      written.add(file);
    } else {
      await unlink(path.join(PUBLIC_DIR, file)).catch(() => {});
      console.warn(`[sitemaps] SKIP ${file} (backend unavailable) — stale copy removed from public/`);
    }
  }

  // Index: prefer the fetched backend index filtered down to the files we
  // actually wrote; otherwise rebuild it from what we wrote. This guarantees
  // the index never references a missing file.
  let indexXml;
  if (fetched.has("sitemap.xml")) {
    const locs = [...fetched.get("sitemap.xml").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
    const keptFiles = [...new Set(locs.map((loc) => loc.split("/").pop()).filter((f) => written.has(f)))];
    indexXml = keptFiles.length > 0 ? buildIndexSitemap(keptFiles) : buildIndexSitemap([...written]);
  } else {
    indexXml = buildIndexSitemap([...written]);
  }
  await writeFile(path.join(PUBLIC_DIR, "sitemap.xml"), indexXml, "utf8");

  if (!backendReachable) {
    console.warn("======================================================================");
    console.warn(`[sitemaps] WARNING: backend ${BACKEND_URL} was unreachable after all retries.`);
    console.warn("[sitemaps] Product/category/image sitemaps were SKIPPED; only a locally");
    console.warn(`[sitemaps] generated sitemap-pages.xml (${STATIC_ROUTES.length} URLs) was written.`);
    console.warn("[sitemaps] Re-run the build when the backend is healthy to restore the full sitemap set.");
    console.warn("======================================================================");
  } else {
    console.log(`[sitemaps] wrote index + ${written.size} sub-sitemap(s) to ${PUBLIC_DIR}`);
  }
}

main().catch((err) => {
  // Never throw: a sitemap failure must not break deploys.
  console.error(`[sitemaps] unexpected error (deploy continues): ${err.message}`);
});
