// ─── Kifayat build-time prerenderer ─────────────────────────────────────────
// Runs AFTER `vite build`. Warmes the backend, starts `vite preview` on the
// built dist (with a preview proxy /api, /socket.io, /uploads -> public
// backend), renders every STATIC_ROUTE in headless Chromium, and writes the
// resulting HTML to dist/<route>/index.html (dist/index.html for "/") so
// Vercel serves real rendered HTML — meta, H1, JSON-LD, product markup — to
// everyone including Googlebot, before the catch-all rewrite.
//
// Resilience:
//   - Ready signal: wait for [data-app-ready="true"] (45s), then fall back to
//     an 8s network-idle wait and snapshot anyway (degraded, best-effort).
//   - Chromium launch failure or preview failure: copy dist/index.html to
//     each route (shell snapshots) and continue.
//   - This script NEVER throws: a prerender failure must not break deploys.
//   - The preview server is always killed in a finally block.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { BACKEND_URL, STATIC_ROUTES, FRONTEND_ROOT, SITE_URL } from "./seo-config.mjs";

const PREVIEW_PORT = 4173;
// Explicit IPv4: some CI hosts resolve "localhost" to ::1 first while
// `vite preview` binds 0.0.0.0 (IPv4-only), so in-page API fetches would
// hit ECONNREFUSED even though the server is healthy.
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;
const DIST_DIR = path.join(FRONTEND_ROOT, "dist");
const HEALTH_URL = `${BACKEND_URL}/api/health`;
const READY_SELECTOR = '[data-app-ready="true"]';
const READY_TIMEOUT_MS = 45_000;
const NETWORK_IDLE_TIMEOUT_MS = 8_000;
const WARM_TIMEOUT_MS = 90_000;

// Product pages. Product URLs come from public/sitemap-products.xml (written
// by generate-sitemaps.mjs BEFORE this script runs). We prerender the top N
// in-stock products (the sitemap is already sorted by salesCount desc) so
// Googlebot gets real per-product HTML — title, canonical, Product JSON-LD —
// instead of the SPA shell. Tune with PRERENDER_PRODUCT_LIMIT.
const PRODUCT_SITEMAP = path.join(FRONTEND_ROOT, "public", "sitemap-products.xml");
const PRODUCT_LIMIT = Number(process.env.PRERENDER_PRODUCT_LIMIT || 2000);
// Max slug length. The full snapshot path is dist/products/<slug>/index.html;
// on Windows the 260-char path cap makes very long slugs fail the local build
// (CI on Linux is fine, but keep parity). Slugs > this are keyword-stuffed
// low-value pages anyway.
const MAX_SLUG_LENGTH = 150;
// Bound per product render ~5s at 5 workers; raise for CI wall-clock parity.
// Tune with PRERENDER_PRODUCT_CONCURRENCY.
const PRODUCT_CONCURRENCY = Number(process.env.PRERENDER_PRODUCT_CONCURRENCY || 10);
// Wall-clock budget for the product phase only. Static routes (incl. the
// homepage) are rendered BEFORE this phase, so hitting the deadline still
// ships a fully prerendered shell of the site; remaining products fall back
// to their already-written snapshots. Tune with PRERENDER_PRODUCT_DEADLINE_MS.
const PRODUCT_DEADLINE_MS = Number(process.env.PRERENDER_PRODUCT_DEADLINE_MS || 2_400_000);
// The product route loader retries 8 x 10s while the backend cold-boots, so a
// single product can legitimately take a while. Settle on the canonical link
// (rendered only once the product data resolves) or the Not-found state.
const PRODUCT_SETTLE_TIMEOUT_MS = 80_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Bounded per-page diagnostics: failed/4xx-5xx API requests and console
// errors. Printed when a page fails, so CI logs explain WHY instead of
// leaving an opaque waitForFunction timeout.
function attachDiagnostics(page, label, sink) {
  const push = (line) => {
    if (sink.length < 10) sink.push(`[${label}] ${line}`);
  };
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.includes("/api/") || u.includes("/socket.io") || u.includes("/uploads")) {
      push(`${req.method()} ${u} -> ${req.failure()?.errorText ?? "failed"}`);
    }
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 400) {
      push(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  page.on("pageerror", (err) => push(`pageerror: ${err.message.slice(0, 160)}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") push(`console.error: ${msg.text().slice(0, 160)}`);
  });
}

const reportDiagnostics = (sink) => {
  for (const line of sink) console.warn(`[prerender-diag] ${line}`);
};

// ─── Backend warming ─────────────────────────────────────────────────────────
async function warmBackend() {
  const started = Date.now();
  while (Date.now() - started < WARM_TIMEOUT_MS) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        console.log(
          `[prerender] backend warm: ${HEALTH_URL} -> HTTP ${res.status} after ${Math.round((Date.now() - started) / 1000)}s`,
        );
        return true;
      }
    } catch {
      // not up yet — keep polling
    }
    await sleep(3_000);
  }
  console.warn(
    `[prerender] backend did not answer ${HEALTH_URL} within ${WARM_TIMEOUT_MS / 1000}s — snapshots may lack product data`,
  );
  return false;
}

// ─── vite preview child process ──────────────────────────────────────────────
function startPreviewServer() {
  const viteBin = path.join(FRONTEND_ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    [viteBin, "preview", "--port", String(PREVIEW_PORT), "--strictPort"],
    {
      cwd: FRONTEND_ROOT,
      env: { ...process.env, PRERENDER_TARGET: BACKEND_URL },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let log = "";
  child.stdout?.on("data", (d) => {
    log += d;
  });
  child.stderr?.on("data", (d) => {
    log += d;
  });
  child.on("error", (err) => {
    log += `\n[vite preview] spawn error: ${err.message}`;
    console.error(log);
  });
  return { child, log: () => log };
}

async function waitForPreview(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(PREVIEW_ORIGIN, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        console.log(`[prerender] preview server ready at ${PREVIEW_ORIGIN}`);
        return true;
      }
    } catch {
      // not ready yet
    }
    await sleep(1_000);
  }
  return false;
}

// ─── Snapshot writing ────────────────────────────────────────────────────────
function isSafeRoute(route) {
  return (
    typeof route === "string" &&
    route.startsWith("/") &&
    !route.split("/").some((seg) => seg === ".." || seg.includes("\\"))
  );
}

async function writeSnapshot(route, html) {
  const relPath = route === "/" ? "index.html" : path.join(route.replace(/^\//, ""), "index.html");
  const outPath = path.join(DIST_DIR, relPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}

async function writeShellSnapshots(shellHtml, routes) {
  for (const route of routes) {
    if (!isSafeRoute(route)) continue;
    await writeSnapshot(route, shellHtml);
  }
}

// ─── Modulepreload injection ─────────────────────────────────────────────────
// The SPA entry discovers the route chunk lazily. Capturing the JS resources
// this render actually used and modulepreloading them in the snapshot lets the
// browser start fetching the route + shared chunks before the entry executes —
// removing a full discovery round-trip on every prerendered page (homepage,
// static routes, and product pages alike). Purely additive: the chunks are
// exactly the ones the browser would load anyway, just signalled earlier.
async function collectJsChunks(page) {
  try {
    return await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .filter((n) => n.includes("/assets/") && n.endsWith(".js"))
        .map((n) => n.split("/assets/")[1]),
    );
  } catch {
    return [];
  }
}

function withModulePreloads(html, chunks) {
  const links = [...new Set(chunks)]
    .map((c) => `<link rel="modulepreload" href="/assets/${c}">`)
    .join("");
  return links ? html.replace("</head>", `${links}</head>`) : html;
}

// ─── Product routes ──────────────────────────────────────────────────────────
/** Load the prerender product list from the sitemap written before this script. */
async function loadProductSlugs() {
  try {
    const xml = await readFile(PRODUCT_SITEMAP, "utf8");
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
    const slugs = [];
    for (const loc of locs) {
      const match = /\/products\/([a-z0-9][a-z0-9-]*)$/.exec(loc);
      if (!match) continue;
      const slug = match[1];
      if (!isSafeRoute(`/products/${slug}`)) continue;
      if (slug.length > MAX_SLUG_LENGTH) {
        console.log(`[prerender] skipping over-long product slug (${slug.length} chars): ${slug.slice(0, 60)}…`);
        continue;
      }
      if (!slugs.includes(slug)) slugs.push(slug);
    }
    const limited = slugs.slice(0, PRODUCT_LIMIT);
    console.log(`[prerender] ${limited.length} product route(s) from sitemap (${slugs.length} total, limit ${PRODUCT_LIMIT})`);
    return limited;
  } catch (err) {
    console.warn(`[prerender] could not read ${PRODUCT_SITEMAP}: ${err.message} — no product pages will be prerendered`);
    return [];
  }
}

/**
 * Render one product page. Unlike static routes we do NOT wait for
 * [data-app-ready]: that signal tracks React Query and can fire before the
 * route loader (which retries up to 8x10s against a cold backend) resolves.
 * Instead we wait until the canonical link points at this exact product URL
 * (rendered only once SEO has product data) or the page settles into its
 * Not-found state — mirroring what Googlebot will see.
 */
async function renderProduct(browser, slug, shellHtml) {
  const route = `/products/${slug}`;
  const page = await browser.newPage();
  const diag = [];
  attachDiagnostics(page, slug.slice(0, 40), diag);
  try {
    await page.goto(PREVIEW_ORIGIN + route, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(
      ({ expectedHref, siteOrigin }) => {
        const canon = document.querySelector('link[rel="canonical"]');
        const href = canon?.getAttribute("href") || "";
        const text = document.body?.textContent || "";
        // Data is loaded once ANY product canonical is rendered (the SEO
        // component only mounts after the route loader resolves). Prefer the
        // exact slug URL; fall back to any /products/ canonical so a rare slug
        // mismatch still snapshots real content instead of the shell.
        return (
          href === expectedHref ||
          (href.startsWith(siteOrigin) && href.includes("/products/")) ||
          text.includes("Not found.")
        );
      },
      { expectedHref: `${SITE_URL}/products/${slug}`, siteOrigin: SITE_URL },
      { timeout: PRODUCT_SETTLE_TIMEOUT_MS, polling: 500 },
    );
    // give the page one beat after the canonical appears so images/JSON-LD settle
    await page.waitForTimeout(300);
    const html = await page.content();
    await writeSnapshot(route, withModulePreloads(html, await collectJsChunks(page)));
    return "fresh";
  } catch (err) {
    reportDiagnostics(diag);
    if (shellHtml) await writeSnapshot(route, shellHtml).catch(() => {});
    console.warn(`[prerender] product ${slug} failed (${err.message}) — wrote shell snapshot`);
    return "shell";
  } finally {
    await page.close().catch(() => {});
  }
}

// ─── Rendering ───────────────────────────────────────────────────────────────
async function renderRoute(browser, route, shellHtml) {
  const page = await browser.newPage();
  const diag = [];
  attachDiagnostics(page, route, diag);
  try {
    await page.goto(PREVIEW_ORIGIN + route, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    let fresh = true;
    try {
      await page.waitForSelector(READY_SELECTOR, { timeout: READY_TIMEOUT_MS });
      // The ready signal can still fire while a slow query is mid-flight or in
      // a TanStack retry backoff, leaving the page on a loading skeleton.
      // Settle the real content per route:
      //   - Homepage: wait for the featured-landing API response, then for the
      //     product grid links to actually render.
      //   - /products & /category/*: wait for product links (or the empty /
      //     error state) to render.
      //   - Everything else: snapshot as-is.
      // Deliberately NOT waiting for ".animate-pulse" to vanish — PageShell /
      // Hero render permanent decorative pulsing dots, so that would stall
      // every route. Socket.io long-polling keeps the network busy, so we
      // settle on DOM content, not networkidle.
      if (route === "/") {
        try {
          await page.waitForResponse(
            (res) =>
              res.url().includes("/api/products/featured-landing") && res.status() < 400,
            { timeout: 30_000 },
          );
          await page.waitForFunction(
            () => document.querySelectorAll('a[href^="/products/"]').length > 0,
            { timeout: 10_000 },
          );
        } catch {
          // give the data one more beat, then snapshot whatever is there
          await page.waitForTimeout(1_500);
        }
      } else if (route === "/products" || route.startsWith("/category/")) {
        try {
          await page.waitForFunction(
            () => {
              const hasProducts = document.querySelectorAll('a[href^="/products/"]').length > 0;
              const text = document.body.textContent || "";
              return hasProducts || text.includes("Nothing found") || text.includes("waking up");
            },
            { timeout: 25_000 },
          );
        } catch {
          // give the data one more beat, then snapshot whatever is there
          await page.waitForTimeout(1_500);
        }
      }
    } catch {
      fresh = false;
      console.warn(`[prerender] ready signal timeout for ${route} — falling back to network-idle wait`);
      try {
        await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS });
      } catch {
        // best-effort: snapshot whatever the page has after domcontentloaded
      }
    }

    // Hydration bridge (homepage only): snapshot the settled React Query cache
    // and embed it in the HTML. The client seeds its cache from this embed and
    // hydrates the prerendered DOM instead of re-rendering it — the biggest
    // FCP/LCP win. Give the cache one extra beat so slow queries settle.
    let embed = null;
    if (route === "/") {
      try {
        await page.waitForTimeout(1_000);
        embed = await page.evaluate(() => window.__KIFAYAT_DUMP__?.() ?? null);
      } catch {
        embed = null;
      }
    }

    // Modulepreload the JS chunks this render actually used (the lazy route
    // chunk + shared chunks) so the browser fetches them before the entry
    // executes — for the homepage (where the route chunk must be present for
    // hydration to kick in) AND every other static route. Products get the
    // same treatment in renderProduct.
    const html = await page.content();
    const embedScript =
      embed && Array.isArray(embed) && embed.length > 0
        ? `<script id="__KIFAYAT_DATA__" type="application/json">${JSON.stringify(embed).replace(/</g, "\\u003c")}</script>`
        : "";
    const finalHtml = withModulePreloads(html, await collectJsChunks(page))
      .replace("</body>", `${embedScript}</body>`);
    await writeSnapshot(route, finalHtml);
    return fresh ? "fresh" : "degraded";
  } catch (err) {
    reportDiagnostics(diag);
    if (shellHtml) await writeSnapshot(route, shellHtml);
    console.warn(`[prerender] route ${route} failed (${err.message}) — wrote shell snapshot`);
    return "shell";
  } finally {
    await page.close().catch(() => {});
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await warmBackend();

  let shellHtml = null;
  try {
    shellHtml = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
  } catch {
    console.warn("[prerender] dist/index.html not found — shell fallback will be limited");
  }

  const results = { fresh: [], degraded: [], shell: [] };
  let preview = null;
  let browser = null;

  try {
    preview = startPreviewServer();
    if (!(await waitForPreview())) {
      throw new Error(`vite preview did not become ready at ${PREVIEW_ORIGIN}`);
    }

    try {
      browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    } catch (err) {
      console.warn("======================================================================");
      console.warn(`[prerender] CHROMIUM LAUNCH FAILED: ${err.message}`);
      console.warn("[prerender] Falling back to shell snapshots (copy of dist/index.html per route).");
      console.warn("[prerender] Install the Playwright browser on the build host with:");
      console.warn("[prerender]   npx playwright install chromium");
      console.warn("======================================================================");
      if (shellHtml) {
        await writeShellSnapshots(shellHtml, STATIC_ROUTES);
        results.shell = [...STATIC_ROUTES];
      }
    }

    if (browser) {
      for (const route of STATIC_ROUTES) {
        if (!isSafeRoute(route)) {
          console.warn(`[prerender] skipping unsafe route: ${route}`);
          results.shell.push(route);
          continue;
        }
        const status = await renderRoute(browser, route, shellHtml);
        results[status].push(route);
        console.log(`[prerender] ${status.toUpperCase().padEnd(8)} ${route}`);
      }

      // Product pages — a bounded concurrency pool keeps the backend from
      // being hammered while still finishing in a reasonable time. Each
      // product gets its own page; failures fall back to a shell snapshot.
      const productSlugs = await loadProductSlugs();
      const productResults = { fresh: 0, shell: 0, failed: [] };
      let cursor = 0;
      const productPhaseStart = Date.now();
      const worker = async () => {
        while (cursor < productSlugs.length) {
          if (Date.now() - productPhaseStart > PRODUCT_DEADLINE_MS) {
            return;
          }
          const slug = productSlugs[cursor];
          cursor += 1;
          const status = await renderProduct(browser, slug, shellHtml);
          productResults[status] = status === "fresh" ? productResults.fresh + 1 : productResults.shell + 1;
          if (status !== "fresh") productResults.failed.push(slug);
          if (cursor % 50 === 0 || cursor === productSlugs.length) {
            console.log(
              `[prerender] products ${cursor}/${productSlugs.length} — ${productResults.fresh} fresh, ${productResults.shell} shell`,
            );
          }
        }
      };
      await Promise.all(Array.from({ length: PRODUCT_CONCURRENCY }, worker));
      results.fresh.push(...Array(productResults.fresh).fill("<product>"));
      results.shell.push(...productResults.failed);
      if (productResults.failed.length > 0) {
        console.warn(`[prerender] product shells: ${productResults.failed.join(", ")}`);
      }
    }
  } catch (err) {
    // Infrastructure failure (preview server, etc.) -> shell fallback.
    console.warn(`[prerender] FATAL: ${err.message} — falling back to shell snapshots for all routes`);
    if (shellHtml) {
      await writeShellSnapshots(shellHtml, STATIC_ROUTES);
      results.shell = [...STATIC_ROUTES];
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (preview?.child && typeof preview.child.kill === "function") {
      preview.child.kill();
      await sleep(300);
    }
  }

  console.log("============================================================");
  const staticFresh = results.fresh.filter((r) => r !== "<product>").length;
  const productFresh = results.fresh.length - staticFresh;
  console.log(
    `[prerender] SUMMARY: ${staticFresh}/${STATIC_ROUTES.length} static fresh, ${productFresh} products fresh, ${results.degraded.length} degraded, ${results.shell.length} shell`,
  );
  if (results.degraded.length > 0) console.log(`[prerender] degraded: ${results.degraded.join(", ")}`);
  if (results.shell.length > 0) console.log(`[prerender] shell: ${results.shell.slice(0, 10).join(", ")}`);
  console.log("============================================================");
}

main().catch((err) => {
  // Never throw: a prerender failure must not break deploys.
  console.error(`[prerender] unexpected error (deploy continues): ${err.message}`);
});
