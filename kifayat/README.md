# Kifayat — Pakistan's Editorial Marketplace

A full-stack e-commerce platform with an editorial storefront, a complete admin suite, and an AI-driven catalog pipeline. The frontend is a React 19 + Vite single-page app with TanStack Router and React Query; the backend is an Express 5 + MongoDB (Mongoose) API with real-time Socket.IO updates and a production admin console.

---

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  kifayat-frontend       │  HTTP  │  kifayat-backend         │
│  React 19 · Vite ·      │ ─────► │  Express 5 · Mongoose ·  │
│  TanStack Router ·      │  /api  │  Socket.IO · Firebase ·  │
│  React Query · Tailwind │ ◄───── │  Resend · Cloudinary     │
└─────────────────────────┘  :5000 └──────────┬───────────────┘
                                              │
                                    MongoDB Atlas (Mongoose)
```

- **Frontend** — `kifayat-frontend/` (port **5000** in dev, Vite dev server)
- **Backend** — `kifayat-backend/` (port **3001** in dev, `nodemon`)
- Dev proxy: Vite forwards `/api`, `/uploads` and `/socket.io` (WebSocket) to `http://localhost:3001`.

---

## Features

### Storefront
- Editorial landing page (hero, curated picks, flash deals, lookbook, founder letter, newsletter)
- Full catalogue with category pages, search, and natural-language product detail pages
- Product detail: image gallery + lightbox, video support, HHC variation selector, similar products
- **Wishlist** (localStorage-backed, login-aware) with wishlist page and quick add-to-bag
- **Cart** with backend price + stock re-validation on every open, self-healing product ids, and stock warnings
- **Checkout** — Cash on Delivery (Pakistan-wide), address autocomplete, order confirmation flow
- Accounts: register/login (email OTP + JWT sessions), order history, addresses, payment methods, vouchers, reviews
- Reviews & Q&A per product, SEO (sitemap, JSON-LD, per-route meta)

### Stock & Catalog Intelligence
- **Variation-aware availability** — when HHC variations exist they are the single source of truth for stock; every customer endpoint (`products`, `product detail`, `similar`, `featured`) reports the same `inStock` flag
- Out-of-stock products are surfaced consistently everywhere (cards, cart, search, wishlist, product page)
- HHC product dynamic-data sync, slug API (`GET /api/products/:slug-or-id`), resumable variation backfill script
- AI copy optimization for the catalog with a **key-pool router** (Groq + Gemini multi-key pools, Gemini-first fast path with Groq fallback, batch splitting)

### Admin Suite (`/admin`)
- Dashboard with live stats, orders (CSV export, pre-orders, cancellations), product management (CSV upload, pricing, categories, out-of-stock management)
- Users, vouchers/compensation, reviews moderation, defective-product reports, website reviews, activity logs
- **AI Studio** — pool status monitor, live health of all Gemini/Groq keys
- Realtime socket events (e.g. `product_out_of_stock`) pushed to the UI

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 7, TypeScript, TanStack Router, TanStack Query, Tailwind CSS 4, Framer Motion, Lenis smooth scroll, Lucide icons, shadcn/ui-style Radix components, Recharts, Leaflet, Sonner, Socket.IO client |
| Backend | Node.js, Express 5, Mongoose 9 (MongoDB Atlas), Socket.IO, JSON Web Tokens, bcrypt, Firebase Admin, Resend/Nodemailer, Groq SDK, `csv-parser`/`xlsx`/`json2csv`, `node-cron`, Multer, Cloudinary, rate limiting, helmet |
| Dev tooling | Vite dev proxy, nodemon, ESLint, Prettier, TypeScript strict |

---

## Getting Started

Prerequisites: **Node.js 18+** and **npm**. MongoDB is expected at the connection string in the backend env (Atlas works — no local mongod needed).

### 1. Backend

```bash
cd kifayat-backend
npm install
cp .env.example .env   # fill in the values (see Env Variables)
npm run dev            # nodemon → http://localhost:3001
```

### 2. Frontend

```bash
cd kifayat-frontend
npm install
cp .env.example .env.local   # fill in VITE_* values
npm run dev                  # Vite → http://localhost:5000
```

Open `http://localhost:5000`.

> Note: the repository deliberately commits the live `.env` and `firebase-service-account.json` (only `node_modules/` is ignored). Rotate credentials before any public fork.

### Production

```bash
cd kifayat-frontend && npm run build   # outputs dist/
cd kifayat-backend  && npm start       # serves API (and can serve dist/)
```

---

## Env Variables

### Backend (`kifayat-backend/.env`)
| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default 3001) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret |
| `FIREBASE_*` | Firebase admin credentials (or via `firebase-service-account.json`) |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail SMTP fallback only (emergency delivery; app passwords are normalized) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Primary transactional sender when the from-address is verified on your branded domain |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | AI copy pipeline (multi-key pools read additional keys from env; see `utils/groqKeyPool.js`, `utils/geminiPool.js`) |
| `CLOUDINARY_*` | Image CDN |
| `CORS_ORIGIN` | Allowed frontend origin |

### Frontend (`kifayat-frontend/.env.local`)
| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE` | API base URL (default `/api` via dev proxy) |
| `VITE_FIREBASE_*` | Firebase web config |
| `VITE_GOOGLE_MAPS_API_KEY` | Address autocomplete |

See `.env.example` in each folder for the full list.

---

## Project Layout

```
├── kifayat-backend/
│   ├── controllers/        # Express route handlers (auth, product, cart, order, admin, AI…)
│   ├── routes/             # API route definitions
│   ├── models/             # Mongoose models (User, Product, Order, PreOrder, Cart, Review…)
│   ├── middleware/         # auth (protect), optionalAuth, adminProtect, rate limiters
│   ├── utils/              # JWT, email, OTP, key pools, out-of-stock manager, categorize…
│   ├── config/             # DB, Firebase admin, tiers
│   ├── scripts/            # backfill + maintenance scripts (backfill_variations, bulk_fetch_dynamic…)
│   └── server.js           # app entry (Express + Socket.IO)
└── kifayat-frontend/
    ├── src/
    │   ├── routes/         # TanStack Router file routes (pages + admin panels)
    │   ├── components/     # UI components (landing, shop, motion, ui, seo)
    │   ├── lib/            # API clients, stores (cart, wishlist, auth), helpers
    │   ├── hooks/          # realtime sync, pricing sync, active time
    │   └── styles/         # CSS (index.css, auth.css, dashboard.css)
    └── vite.config.ts      # dev proxy, Tailwind, TanStack plugin
```

---

## Useful Scripts

```bash
# Backend (run from kifayat-backend/)
node scripts/backfill_variations.js          # resumable HHC variation backfill (--limit, --concurrency)
node scripts/bulk_fetch_dynamic.js           # bulk HHC dynamic-data refresh
node scripts/refresh_all_dynamic.js          # refresh all dynamic data
node scripts/benchmark_groq_pool.js          # AI pool benchmark
```

---

## License

ISC — see `kifayat-backend/package.json`.

## Contact

**Phone:** +92-337-397-5015

---

## Deployment

### Backend — Northflank

The backend is deployed on Northflank and auto-deploys from `main` (builds `kifayat-backend` via its Dockerfile). Pushing to `main` triggers the deploy.

1. Commit backend changes and push to `main`
2. Northflank auto-deploy builds the service and starts it
3. Health Check: `/api/health`
4. Environment variables are configured in the Northflank dashboard (see table below)

### Frontend — Vercel

1. Create a **Static Site** on Vercel → connect `Muhib-Khan/Kifayat` → branch `main`
2. **Root Directory**: `kifayat-frontend`
3. **Framework Preset**: Vite (auto-detected)
4. **Build Command**: `npm run vercel-build`
5. The `vercel.json` rewrites `/api`, `/socket.io`, `/uploads` to the backend URL
6. Add a Vercel **Deploy Hook** for the production project, store the hook URL in GitHub as `VERCEL_DEPLOY_HOOK_URL`, and let the repo’s workflow fire it on every push to `main`
7. Environment variables (see table below)
8. Deploy!

> The GitHub workflow only needs `VERCEL_DEPLOY_HOOK_URL`. No Vercel API token is stored in the repo for deployment.

### Environment Variables

**Backend (Northflank) — Secrets:**
| Variable | Source |
|---|---|
| `MONGODB_URI` | `kifayat-backend/.env` |
| `JWT_SECRET` | `kifayat-backend/.env` |
| `FIREBASE_SERVICE_ACCOUNT` | Paste JSON from `firebase-service-account.json` |
| `EMAIL_PASS` | `kifayat-backend/.env` |

**Backend (Northflank) — Regular:**
| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | *(platform-managed)* |
| `JWT_EXPIRE` | `30d` |
| `CORS_ORIGINS` | `https://kifayat-jet.vercel.app,https://www.kifayat.co` |
| `FRONTEND_URL` | `https://www.kifayat.co` |
| `SITE_URL` | `https://p01--kifayat-backend--62p9lfb7xpvc.code.run` |
| `SITE_NAME` | `Kifayat` |
| `ADMIN_EMAILS` | *(from `.env`)* |
| `EMAIL_USER` | *(from `.env`)* |
| `RESEND_FROM_EMAIL` | `noreply@kifayat.co` |
| `FIREBASE_PROJECT_ID` | `kifayat--auth-data` |
| `HHC_API_URL` | `https://member.hhcdropshipping.com/api` |
| `HHC_REFERER` | `https://member.hhcdropshipping.com/` |
| `HHC_ORIGIN` | `https://member.hhcdropshipping.com` |
| `RESEND_API_KEY` | *(from `.env` — optional)* |
| `GROQ_API_KEY` | *(from `.env` — optional)* |

**Frontend (Vercel) — Public:**
| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | *(from `.env.local`)* |
| `VITE_FIREBASE_AUTH_DOMAIN` | *(from `.env.local`)* |
| `VITE_FIREBASE_PROJECT_ID` | *(from `.env.local`)* |
| `VITE_FIREBASE_STORAGE_BUCKET` | *(from `.env.local`)* |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | *(from `.env.local`)* |
| `VITE_FIREBASE_APP_ID` | *(from `.env.local`)* |
| `VITE_FIREBASE_MEASUREMENT_ID` | *(from `.env.local`)* |

