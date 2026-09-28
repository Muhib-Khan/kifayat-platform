import { defineConfig } from "vite";
import type { HttpProxy } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The backend restarts during development (nodemon on save, crash recovery).
// While it is down every proxied request fails with ECONNREFUSED/ECONNRESET and
// Vite prints a multi-line stack dump per attempt. Short-circuit those with a
// clean 503 and a single-line notice so the terminal stays readable, and let
// clients (socket.io, fetch) back off and retry instead of hanging.
const configureProxy = (proxy: HttpProxy.Server) => {
  proxy.on("error", (err, req, res) => {
    const isSocketIo = req?.url?.startsWith?.("/socket.io");
    if (
      !isSocketIo &&
      ((err as NodeJS.ErrnoException)?.code === "ECONNREFUSED" ||
        (err as NodeJS.ErrnoException)?.code === "ECONNRESET" ||
        (err as NodeJS.ErrnoException)?.code === "ETIMEDOUT")
    ) {
      err.stack = "[vite proxy] backend is starting up or was restarted — retrying shortly.";
    }
    if (res && !isSocketIo && "headersSent" in res && !res.headersSent && !res.writableEnded) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Backend unavailable — retrying shortly.");
    }
  });
};

// Preview-server proxy target. During builds there is no local backend, so
// vite preview (used by scripts/prerender.mjs) proxies to the public backend.
// scripts/prerender.mjs sets PRERENDER_TARGET explicitly to the same value as
// BACKEND_URL in scripts/seo-config.mjs.
const previewTarget = () =>
  process.env.PRERENDER_TARGET || "https://p01--kifayat-backend--62p9lfb7xpvc.code.run";

// Dev-server proxy target. Defaults to the local backend (npm start in
// kifayat-backend on :3001). Set DEV_PROXY_TARGET to point the storefront at
// the public API instead — handy when the local database has no store data.
const devTarget = () => process.env.DEV_PROXY_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("leaflet")) return "maps";
          if (id.includes("firebase") || id.includes("@firebase")) return "auth-firebase";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-dom") || id.includes("react/") || id.includes("scheduler")) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@radix-ui") || id.includes("cmdk")) return "ui-primitives";
          if (id.includes("socket.io") || id.includes("engine.io")) return "realtime";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/socket.io": {
        target: devTarget(),
        ws: true,
        changeOrigin: true,
        configure: configureProxy,
      },
      "/uploads": {
        target: devTarget(),
        changeOrigin: true,
      },
      "/api": {
        target: devTarget(),
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
        configure: (proxy) => {
          configureProxy(proxy);
          proxy.on("proxyRes", (proxyRes) => {
            // Rewrite Secure flag on Set-Cookie headers so cookies work in
            // the Vite dev proxy (HTTP → backend) even when NODE_ENV=production.
            const setCookie = proxyRes.headers["set-cookie"];
            if (setCookie) {
              proxyRes.headers["set-cookie"] = (Array.isArray(setCookie) ? setCookie : [setCookie]).map(
                (cookie) => cookie.replace(/;\s*Secure/gi, "").replace(/;\s*SameSite=None/gi, "; SameSite=Lax"),
              );
            }
          });
        },
      },
    },
  },
  // Mirrors server.proxy for `vite preview` (used by scripts/prerender.mjs
  // against the built dist). Same three targets and cookie handling, but the
  // target is the PUBLIC backend (no local backend exists during builds).
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    proxy: {
      "/socket.io": {
        target: previewTarget(),
        ws: true,
        changeOrigin: true,
        configure: configureProxy,
      },
      "/uploads": {
        target: previewTarget(),
        changeOrigin: true,
      },
      "/api": {
        target: previewTarget(),
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
        configure: (proxy) => {
          configureProxy(proxy);
          proxy.on("proxyRes", (proxyRes) => {
            const setCookie = proxyRes.headers["set-cookie"];
            if (setCookie) {
              proxyRes.headers["set-cookie"] = (Array.isArray(setCookie) ? setCookie : [setCookie]).map(
                (cookie) => cookie.replace(/;\s*Secure/gi, "").replace(/;\s*SameSite=None/gi, "; SameSite=Lax"),
              );
            }
          });
        },
      },
    },
  },
});
