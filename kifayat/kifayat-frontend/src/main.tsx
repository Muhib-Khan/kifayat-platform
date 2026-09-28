import { StrictMode, useEffect } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import "./fonts.css";
// Temporarily disabled Sentry initialization to fix production error
// import "./lib/sentry"; // Initialize Sentry for error monitoring

declare global {
  interface Window {
    /** Prerender bridge — snapshots the settled query cache. Only called by scripts/prerender.mjs. */
    __KIFAYAT_DUMP__?: () => { key: readonly unknown[]; data: unknown }[];
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 s — products refetch quickly so prices stay fresh
      // The backend (https://p01--kifayat-backend--62p9lfb7xpvc.code.run)
      // sleeps after inactivity and can take 30–60 s to cold-boot. Retry long
      // enough to outlast the wake-up so visitors reopening the site don't see
      // a spurious error.
      retry: (failureCount) => failureCount < 4,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Prefetch the next route's chunk as soon as the pointer enters the link
  // (no hover delay), and keep it fresh across navigations so admin page
  // switches don't re-download chunks.
  defaultPreloadDelay: 0,
  defaultPreloadStaleTime: 0,
  // Show the route pending skeleton immediately on slow chunk loads instead
  // of a blank flash; suppress it for fast intra-page navigations.
  defaultPendingMinMs: 80,
  defaultPendingMs: 1200,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ─── Prerender hydration bridge ──────────────────────────────────────────────
// scripts/prerender.mjs snapshots the settled React Query cache into
// <script id="__KIFAYAT_DATA__" type="application/json"> inside the prerendered
// HTML. We seed those entries back into the cache BEFORE the first render so
// the initial client render matches the prerendered DOM exactly — letting us
// hydrate the page instead of re-rendering it from scratch (the biggest
// FCP/LCP win: the prerendered content is visible immediately).
//
// If the embed is missing or corrupt (non-prerendered routes, degraded
// prerender), we fall back to a plain client render — the previous behaviour.
type EmbeddedQuery = { key: unknown[]; data: unknown };

function readEmbeddedQueries(): EmbeddedQuery[] | null {
  const el = document.getElementById("__KIFAYAT_DATA__");
  if (!el?.textContent) return null;
  try {
    const parsed: unknown = JSON.parse(el.textContent);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (q): q is EmbeddedQuery =>
        !!q &&
        Array.isArray((q as EmbeddedQuery).key) &&
        (q as EmbeddedQuery).data !== undefined,
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

const embeddedQueries = readEmbeddedQueries();
if (embeddedQueries) {
  for (const { key, data } of embeddedQueries) {
    queryClient.setQueryData(key, data);
  }
}

// Prerender bridge: expose the settled query cache so scripts/prerender.mjs can
// snapshot it into the HTML. Read-only and never called in production.
window.__KIFAYAT_DUMP__ = () =>
  queryClient
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.status === "success" && q.state.data !== undefined)
    .map((q) => ({ key: q.queryKey, data: q.state.data }));

const root = document.getElementById("root")!;

// The built index.html (prerendered homepage) ships a canonical/og:url in its
// <head>. Because it is the SPA shell served for every route, that stale
// canonical would leak into every page alongside the per-route one helmet
// renders. Remove any pre-existing canonical/og:url so react-helmet-async is
// the single source of truth for the head.
for (const el of Array.from(document.querySelectorAll('link[rel="canonical"], meta[property="og:url"]'))) {
  el.remove();
}

/**
 * Build-time prerender signal. Sets data-app-ready="true" on #root once the
 * app has settled: no in-flight TanStack Query fetches AND the router has had
 * a grace beat to mount the matched route (lazy route chunks load
 * asynchronously on first navigation, so isFetching may still be 0 before a
 * page's own queries start). A 20s fallback guarantees the signal always
 * fires even if some background poll never idles. Visually inert.
 *
 * The prerender script additionally waits for the product grid to settle on
 * product-bearing routes, covering the retry-backoff window where isFetching
 * momentarily reports 0 while a query waits to refetch.
 *
 * Consumed by scripts/prerender.mjs (page.waitForSelector('[data-app-ready="true"]')).
 */
function AppReady() {
  const isFetching = useIsFetching();

  useEffect(() => {
    const appRoot = document.getElementById("root");
    if (!appRoot) return;
    const markReady = () => appRoot.setAttribute("data-app-ready", "true");
    // Grace period so lazy route chunks finish mounting and kick off their
    // data fetches before we trust isFetching === 0 as "settled".
    const graceTimer = setTimeout(() => {
      if (isFetching === 0) markReady();
    }, 1500);
    // Hard fallback — always fires, even with never-idling background polls.
    const fallbackTimer = setTimeout(markReady, 20_000);
    return () => {
      clearTimeout(graceTimer);
      clearTimeout(fallbackTimer);
    };
  }, [isFetching]);

  return null;
}

function App() {
  return (
    <StrictMode>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AppReady />
          <RouterProvider router={router} />
        </QueryClientProvider>
      </HelmetProvider>
    </StrictMode>
  );
}

if (embeddedQueries) {
  // Prerendered HTML with embedded query data → hydrate (reuse the DOM).
  // We still give the router a short head start so the first render can line
  // up with the server markup when the route chunks are already warm, but we
  // stop waiting after a brief grace period so the page becomes interactive
  // quickly on slower connections.
  const loadPromise = router.load().catch(() => {});
  await Promise.race([
    loadPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 1200)),
  ]);
  hydrateRoot(root, <App />);
} else {
  // No embed (non-prerendered route or degraded prerender) → client render.
  createRoot(root).render(<App />);
}
