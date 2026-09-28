# Kifayat Backend — Production Hosting

The backend runs on **Northflank** and is deployed automatically from this repo via git push to `main` (auto-deploy on the `kifayat-backend` directory).

- Monorepo: `kifayat-main/` (GitHub: `Muhib-Khan/Kifayat`, branch `main`)
- Backend root: `kifayat-backend/` (contains `package.json` and `server.js`)
- Build: Docker (`kifayat-backend/Dockerfile`) or Node runtime — platform-managed
- Health check: `/api/health`

## Backend entrypoint URL

The production backend URL is **unchanged** and is referenced in:

- `kifayat-frontend/vercel.json` — rewrites for `/api/*`, `/socket.io/*`, `/uploads/*`
- `kifayat-frontend/vite.config.ts` — `PRERENDER_TARGET` default
- `kifayat-frontend/scripts/seo-config.mjs` — `BACKEND_URL` default

```
https://p01--kifayat-backend--62p9lfb7xpvc.code.run
```

> Do not change these URLs unless the Northflank service URL changes. The Vercel frontend proxies all backend traffic through these rewrites, so the backend must stay reachable at that address.

## Deploying

1. Commit changes under `kifayat-backend/` and push to `main`.
2. Northflank auto-deploy builds the service from the Dockerfile and starts it.
3. Watch the deploy logs for a healthy boot:

```
MongoDB connected: <host>
Firebase Admin ready  project=<project_id>   (or the fallback message)
Server on port <PORT> [production]
```

If startup exits before "Server on port", the usual cause is a missing `MONGODB_URI` or `JWT_SECRET` (the startup guard in `server.js` logs `Missing critical env vars` and calls `process.exit(1)`).

## Environment variables

Copy the values from `kifayat-backend/.env` into the Northflank dashboard (encrypted there; never commit them).

| Key | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection (Atlas `mongodb+srv://…`); server exits without it |
| `JWT_SECRET` | Yes | Signs auth cookies/JWTs. **Reuse the existing value verbatim** — changing it logs out every user |
| `NODE_ENV` | Yes | `production` → secure cookies, `SameSite=None`, generic error messages |
| `PORT` | No — omit | Platform injects its own; code binds `process.env.PORT \|\| 5000` |
| `JWT_EXPIRE` | No | Token lifetime; default `30d` |
| `ADMIN_EMAILS` | Recommended | Comma-separated emails granted admin role + notified by automated jobs |
| `EMAIL_USER`, `EMAIL_PASS` | Fallback only | Gmail SMTP emergency path for OTP/signup/password/order emails. Paste the app password without spaces; the runtime strips whitespace, but copying it cleanly avoids auth surprises. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Yes for production | Primary transactional path when `RESEND_FROM_EMAIL` is a verified sender on your branded domain. Do **not** use `onboarding@resend.dev` for production mail. |
| `PUBLIC_APP_URL` | Recommended | Base URL used in emailed order-confirmation links | `https://www.kifayat.co` |
| `FRONTEND_URL` | No | CORS default origin + email-link fallback | `https://www.kifayat.co` |
| `SITE_URL` | No | Email-link fallback | `https://www.kifayat.co` |
| `CORS_ORIGINS` | No | Comma-separated extra browser origins | `https://kifayat-jet.vercel.app,https://www.kifayat.co` |
| `FIREBASE_SERVICE_ACCOUNT` | Yes for Google login | JSON contents of the gitignored `firebase-service-account.json` as one env var (firebaseAdmin.js normalizes `\n` in `private_key`) |
| `FIREBASE_PROJECT_ID` | No | Used by the ADC fallback path; also shown at `/api/health/firebase` | `kifayat--auth-data` |
| `GROQ_API_KEY` | No | AI product copy/categorization |
| `GEMINI_API_KEY` | No | Gemini pool for AI tasks |
| `HHC_API_URL`, `HHC_REFERER`, `HHC_ORIGIN` | No | HHC dropshipping proxy (code has defaults if omitted) |

For production transactional mail, verify the sending domain in your email provider and publish SPF, DKIM, and DMARC for the same branded domain used in `RESEND_FROM_EMAIL`. Generic provider addresses are fine for local testing, but they hurt inbox placement in production.

Key names in `.env.example` that are **not read by the runtime**: `BACKEND_URL`, `SITE_NAME`. Script-only keys (optional): `GROQ_GOLDEN_KEYS`, `GEMINI_GOLDEN_KEYS`.

The HHC dropshipper token is **not** an environment variable — it lives in MongoDB (`Settings.hhcToken`) and is managed through the admin UI, so it follows the database, not the host.

## Verifying a deploy

- `GET /api/health` → `{ success: true, status: "ok", timestamp }`. This is the platform health-check path.
  - Caveat: `/api/health` does **not** touch MongoDB. To prove the DB link, hit a DB-backed route:
    - `GET /sitemap-products.xml` (queries the `Product` collection), or
    - `GET /api/settings` (queries `Settings`).
- `GET /sitemap.xml` → XML sitemap index. `CANONICAL_URL` is hardcoded to `https://www.kifayat.co`, so sitemap URLs stay correct regardless of the backend host.
- `GET /api/health/firebase` → shows which Firebase project the service account loaded.

```powershell
Invoke-WebRequest https://p01--kifayat-backend--62p9lfb7xpvc.code.run/api/health     # 200 JSON
Invoke-WebRequest https://p01--kifayat-backend--62p9lfb7xpvc.code.run/sitemap.xml    # 200 XML
Invoke-WebRequest https://p01--kifayat-backend--62p9lfb7xpvc.code.run/sitemap-products.xml  # 200 XML (proves DB)
```

## Socket.IO / realtime

The frontend connects with `io("/", { transports: ["polling"] })` (`src/lib/socket.ts`) — **long-polling only**. That is the transport that works through Vercel rewrites and every proxy. A browser test: open `https://www.kifayat.co` → DevTools → Network → filter `socket.io` — you should see repeated `POST …/socket.io/?EIO=4&transport=polling` requests returning `200`, and events like `products_updated` triggering query refreshes.

Vercel rewrites do not tunnel raw WebSocket upgrades to an external host. Since the frontend is polling-only, this does not matter today — keep it that way unless the client code is changed to point the socket directly at the backend URL.

## Uploads and persistence

The app writes user files locally with multer:

- Avatars → `<backend>/uploads/` (`routes/authRoutes.js`)
- Defective-product photos/videos → `<backend>/uploads/defective/` (`routes/defectiveProductRoutes.js`)

and serves them at `/uploads` via `express.static("uploads")`. A persistent volume must be mounted at the `uploads` path so files survive redeploys. Verify after a deploy: upload an avatar (or submit a defective report with an image), note the `/uploads/…` URL, trigger a redeploy, then confirm the same URL still returns the image.

## CORS

`utils/corsConfig.js` builds its allowlist from: `FRONTEND_URL` (or a localhost default), the hardcoded pair `https://www.kifayat.co`, `https://kifayat-jet.vercel.app`, and every entry in `CORS_ORIGINS`. All env-sourced URLs are normalized by `utils/appUrl.js` (apex `kifayat.co` is mapped to www; missing values fall back to www). Prefer the `CORS_ORIGINS` env var over editing code when adding new storefront origins (e.g. Vercel preview-branch URLs, which are NOT hardcoded).

With `NODE_ENV=production`, cookies are `Secure` + `SameSite=None`, and `credentials: true` is set on both the HTTP and Socket.IO CORS configs — keep those as-is. The auth cookie configuration is what lets the Vercel frontend and the backend (a different site) exchange it.

## Rollback

1. **Backend**: revert the backend commit (`git revert`) and push to `main`; Northflank auto-deploys the previous build. The database is the single source of truth (MongoDB), so nothing is lost from the DB — only local uploads are host-specific.
2. **Frontend**: the current `vercel.json` rewrite destinations are committed in git history — rollback is `git checkout` of the previous `vercel.json` (or `git revert` of the rewrite commit) and a redeploy of Vercel. Vercel retains deployment history as a safety net.

## Checklist

| Phase | Item |
|---|---|
| Deploy | Push backend changes to `main` → Northflank auto-deploy from `kifayat-backend` |
| Deploy | Env vars match `kifayat-backend/.env` (never commit secrets) |
| Deploy | Logs show `MongoDB connected`, Firebase line, `Server on port … [production]` |
| Post-deploy | `/api/health` returns `200` JSON |
| Post-deploy | `/sitemap.xml` returns `200` XML |
| Post-deploy | A DB-backed route (`/sitemap-products.xml` or `/api/settings`) returns `200` |
| Post-deploy | `/api/health/firebase` shows the real project id |
| Post-deploy | Socket.IO long-polling requests appear in DevTools on the live site |
| Post-deploy | Upload a test file, note its `/uploads/…` URL, redeploy, confirm it still loads (volume works) |
| Post-deploy | Storefront loads; cart validates; checkout works; admin realtime events; uploads served |