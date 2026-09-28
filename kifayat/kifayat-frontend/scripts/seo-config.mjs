// ─── Kifayat SEO build configuration ────────────────────────────────────────
// Single source of truth for the SEO build tooling:
//   - scripts/generate-sitemaps.mjs  (backend sitemap fetching + local fallback)
//   - scripts/prerender.mjs          (build-time prerendering)
// Dependency-free by design so it runs on any Node >= 20 without a build step.
//
// Static routes are derived from three sources:
//   1. Route files in src/routes/*.tsx (about.tsx -> /about, ...), excluding
//      layout files (`_` prefix), dynamic routes (`$`), escaped-literal routes
//      (`[` — sitemap[.]xml renders nothing), and private/flow paths.
//   2. Blog posts from src/lib/blog-data.ts (post.id -> /blog/<id>).
//   3. Categories from src/lib/shop-data.ts (category.slug -> /category/<slug>).
// The data files are parsed as text (they are TSX/TS with `@/` aliases that a
// plain Node script cannot import) using only the literal string fields.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to kifayat-frontend/. */
export const FRONTEND_ROOT = path.resolve(__dirname, "..");

/** Public backend origin. Override with BACKEND_URL for local testing. */
export const BACKEND_URL =
  process.env.BACKEND_URL || "https://p01--kifayat-backend--62p9lfb7xpvc.code.run";

/** Canonical origin — the apex kifayat.co 308-redirects to www, so sitemaps use www. */
export const SITE_URL = "https://www.kifayat.co";

const ROUTES_DIR = path.join(FRONTEND_ROOT, "src", "routes");
const LIB_DIR = path.join(FRONTEND_ROOT, "src", "lib");

// Private / flow paths that must never be prerendered or sitemapped. The admin
// area lives under src/routes/_authenticated and is already excluded by the
// "_" layout rule; these prefixes catch the remaining non-indexable paths.
const EXCLUDED_SEGMENTS = new Set([
  "admin",
  "auth",
  "account",
  "cart",
  "checkout",
  "login",
  "register",
  "confirm-order",
  "report-defective",
]);

/** Map a route file name to its URL path (dots separate nested path segments). */
function routeFileToPath(fileName) {
  const segments = fileName.replace(/\.tsx$/, "").split(".");
  if (segments.some((seg) => seg === "" || EXCLUDED_SEGMENTS.has(seg))) return null;
  // blog.index.tsx -> /blog, index.tsx -> /
  if (segments[segments.length - 1] === "index") segments.pop();
  return "/" + segments.join("/");
}

/** Static routes derived from the route files in src/routes/*.tsx. */
function routesFromRouteFiles() {
  const routes = [];
  for (const file of readdirSync(ROUTES_DIR)) {
    if (!file.endsWith(".tsx")) continue; // matches src/routes/*.tsx (top level only)
    if (file.startsWith("_")) continue; // layouts / root (_authenticated, __root)
    if (file.includes("$")) continue; // dynamic: category.$slug, blog.$slug, products.$productId
    if (file.includes("[")) continue; // escaped-literal: sitemap[.]xml renders nothing
    const route = routeFileToPath(file);
    if (route) routes.push(route);
  }
  return routes;
}

/** Slugs are URL path segments — only allow safe characters. */
function isSafeSlug(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

/** Extract a list of literal string fields from a source file, scoped after a marker. */
function extractQuoted(source, marker, fieldPattern) {
  const start = source.indexOf(marker);
  const chunk = start === -1 ? source : source.slice(start);
  return [...chunk.matchAll(new RegExp(fieldPattern, "g"))].map((m) => m[1]);
}

/** Blog posts from src/lib/blog-data.ts (blogPosts[i].id -> /blog/<id>). */
function routesFromBlogData() {
  const source = readFileSync(path.join(LIB_DIR, "blog-data.ts"), "utf8");
  const ids = extractQuoted(source, "export const blogPosts", `id:\\s*"([^"]+)"`);
  return ids
    .filter((id) => {
      if (isSafeSlug(id)) return true;
      console.warn(`[seo-config] skipping unsafe blog id: ${id}`);
      return false;
    })
    .map((id) => `/blog/${id}`);
}

/** Categories from src/lib/shop-data.ts (categories[i].slug -> /category/<slug>). */
function routesFromShopData() {
  const source = readFileSync(path.join(LIB_DIR, "shop-data.ts"), "utf8");
  // Product slugs are computed at runtime (p.name.toLowerCase()...) so the
  // only literal `slug: "..."` fields in the file are category slugs.
  const slugs = extractQuoted(source, "export const categories", `slug:\\s*"([^"]+)"`);
  return slugs
    .filter((slug) => {
      if (isSafeSlug(slug)) return true;
      console.warn(`[seo-config] skipping unsafe category slug: ${slug}`);
      return false;
    })
    .map((slug) => `/category/${slug}`);
}

/** Every static route the sitemap fallback and the prerenderer must handle. */
export const STATIC_ROUTES = [
  ...new Set([...routesFromRouteFiles(), ...routesFromBlogData(), ...routesFromShopData()]),
].sort();
