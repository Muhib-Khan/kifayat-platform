# Kifayat — Full Architecture Reference (verified Aug 2026)

> Root: `F:\Kifayat-Complete\Engineered-Kifayat-Complete--main`
> Monorepo: `kifayat-backend` (Express 5, port 3001) + `kifayat-frontend` (React 19 + Vite, port 5000)
> Stack: MERN + Socket.IO + Firebase Auth + HHC dropshipping + Groq AI. CommonJS backend, TS-less frontend builds (strict:false).

## Run commands
- Backend: `cd kifayat-backend; npm run dev` (nodemon server.js). Startup REQUIRES `MONGODB_URI` + `JWT_SECRET` (else process.exit(1)).
- Frontend: `cd kifayat-frontend; npm run dev` (Vite, port 5000, strictPort).
- Vite proxy: `/api`, `/uploads`, `/socket.io` → `http://localhost:3001`; Set-Cookie rewritten (Secure stripped, SameSite=None→Lax) in proxyRes.

## Backend (server.js, 706 lines)
- Helmet with COOP `same-origin-allow-popups` (Firebase popup); CORS allowlist via `utils/corsConfig.js`; Socket.IO on same HTTP server with shared `verifySessionToken` (anonymous sockets allowed; rooms `defective-<reportId>`).
- Auth: cookie `kifayat_token` (httpOnly, 30d) + Mongo `Session` collection (TTL). JWT payload `{userId, firebaseUID, email}`. `protect` middleware: cookie→JWT→Session match→User exists+isVerified; expired session deleted.
- Rate limits: global 5000/15min; authLimiter 15/15min; otpLimiter 6/15min.
- Sitemaps (index/pages/products/categories/image) + robots.txt in server.js; CANONICAL_URL = https://kifayat.com.
- Startup tasks: restore out-of-stock deletion timers, price diagnostic monitor (10 min), active-user monitor (2 min), restore pending pre-order cancellation timers.
- Scheduled work uses setInterval/setTimeout — NO node-cron usage.

## Backend structure
- `config/`: db.js (mongoose), firebaseAdmin.js (4-tier credential fallback), tiers.js (bronze/silver/gold/platinum: 0/3/10/25 orders, 0/5000/25000/75000 spent).
- `models/` (31): User(SignupUsers), Session(UserSessions), RegisterUserData, Product, Category, Cart, Order, Review, WebsiteReview, ShippingDetail, Otp, ActivityLog, BlockedUser, CancelOrder, CancelledOrders, CompensationVoucher, ConfirmationGap, DefectiveProductReport, DeletedUser, DiscountVoucher, LateConfirmationOrder, LoginHistory, MainOrderCSVData(strict:false, unique orderID), OrderHistory(strict:false), OutOfStockDeletedProduct, PreOrder, PriceDiagnostic, PurchasedVoucher, Report, Settings, UserFinalData.
- `middleware/`: auth.js (protect, verifySessionToken), adminProtect.js (requireAdmin), optionalAuth.js, rateLimiters.js, requestLogger.js.
- `utils/`: email.js (Gmail nodemailer first, Resend fallback; sendOTPEmail, sendOrderConfirmationLinkEmail 10-min token, sendLateConfirmationEmail, sendStockExhaustionEmail, sendCompensationEmail, sendAdminNotification...), otp.js (6-digit SHA-256, 10-min, Otp collection), outOfStockManager.js (2-min deletion timer, restored on startup), compensation.js (vouchers: discount_all/discount_specific/free_product, 30-day expiry), groqProductOptimizer.js (llama-3.3-70b-versatile, batch 10, concurrency 3), groqKey.js (Settings-driven task-scoped keys), categorize.js (6 categories keyword scoring), loginLogger.js, activityLogger.js, activeUserMonitor.js, corsConfig.js, jwt.js, cookies.js.
- `controllers/` (17): authController (~1461 lines), productController (~1461 lines), orderController, orderWorkflowController (STOCK_THRESHOLD=15), hhcApiController, userController, cartController, csvExportController, aiController, diagnosticController, defectiveProductController, reviewController, settingsController, voucherController, websiteReviewController, activityLogController, userFinalDataController.
- Unused deps (declared, zero references): @wppconnect-team/wppconnect, cloudinary, xlsx, json2csv, node-cron, qrcode-terminal.

## Key backend logic
- **Order lifecycle**: checkout → Order(pending) + ConfirmationGap(10-min token) → email link confirm → PreOrder(confirmed, finalized) + MainOrderCSVData → admin downloads CSV (atomic claim exported:false→true) → OrderHistory archive + delete. Timeout → CancelledOrders + stock restored. Pre-order cancellation timers restored on restart.
- **HHC sync**: pages of 40, 5-7s random delay, 60s window per 10 pages, grace period 5 min, newProduct flag cleanup, out-of-stock delete + archive. `products_updated`, `product_deleted`, `hhc_progress`, `pricing_updated` socket events.
- **Email link tokens**: confirmation (10 min), cancel, compensation, diagnostic confirm, pre-order confirm/cancel — all public GET routes with token param.

## Frontend (src/, TanStack Router file-based, routeTree.gen.ts)
- **HTTP**: `lib/api.ts` fetch wrapper (no axios): `api.get/post/put/patch/del`, credentials include, BASE `/api`. `normalizeProduct()` is the single Mongo→UI snake_case conversion point (UIProduct type in api.ts).
- **State**: `lib/auth-store.ts` (external store, cookie-based, refreshAuth()→GET /auth/me, signOut), `lib/cart-store.ts` (localStorage `kifayat.cart.v1`, shipping 0 if subtotal≥2500 else 200, refreshCartPrices/validateCartStock via POST /api/cart/validate), `lib/ui-store.ts` (drawer).
- **Socket**: `lib/socket.ts` getSocket() polling-only. `hooks/use-realtime-sync.ts` + `use-pricing-sync.ts` invalidate all product queries on events.
- **Route tree highlights**: `/` home; `/products`, `/products/$productId`, `/category/$slug`, `/cart`, `/checkout`, `/search`, `/auth` (real login/register, Firebase Google), `/account/*` (client-side guard), `/_authenticated` (beforeLoad GET /auth/me → redirect /auth), `/_authenticated/admin` (role check; 15 sidebar sections: dashboard, orders, low-stock, products, reviews, defect-reports, users, activity-logs, website-reviews, vouchers, user-data, ai, diagnostic, hhc, settings). `/login` + `/register` are dead placeholders.
- **Key constants**: STATUSES pending/confirmed/shipped/delivered/cancelled; COURIER_COMPANIES [TCS, Leopards, Call Courier, DHL, Pakistan Post, Swyft, Trax]; order ref `KFY-${_id.slice(-6).toUpperCase()}`; COD-only checkout; TIERS in shop.functions.ts; free shipping ≥ Rs 2,500.
- **Known shims/gaps**: addresses + wishlist + recently-viewed are localStorage only (no backend); reviews Q&A stubbed; `components/ProductCard.jsx` dead code; `lib/shop-data.ts` static demo fallback; `src/seo/` old JS superseded by `components/seo/`.

## .env keys (backend)
MONGODB_URI, PORT=3001, JWT_SECRET, JWT_EXPIRE=30d, RESEND_API_KEY, FRONTEND_URL, BACKEND_URL, FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_PATH, EMAIL_USER, EMAIL_PASS, ADMIN_EMAILS, NODE_ENV, SITE_URL, SITE_NAME, VITE_* (SEO), HHC_API_URL/HHC_REFERER/HHC_ORIGIN, GROQ_API_KEY. Optional: CORS_ORIGINS, PUBLIC_APP_URL, RESEND_FROM_EMAIL, FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS.
Frontend: VITE_FIREBASE_* (real project `kifayat--auth-data`), VITE_API_URL (empty), VITE_MAPBOX_TOKEN/VITE_HERE_API_KEY (unused; Nominatim fallback).

## Gotchas for future coding
1. Backend is CommonJS, frontend is ESM (`type: module`).
2. Express 5 semantics (query getter, async error handling).
3. Never store tokens in localStorage — cookie auth only.
4. Admin routes must be registered before `/:id` param routes (productRoutes.js:47 pattern).
5. Public product routes must not leak wholesalePrice/stock (toPublicObject).
6. Socket transport polling-only — don't switch to websockets.
7. Cart/checkout is COD-only via `shipping: "cod"`.
8. Changing ports requires updating Vite proxy (3001) and frontend port (5000).
9. Admin email list from ADMIN_EMAILS env only — role assigned at login.
10. Vite dev proxy strips Secure/rewrites SameSite on Set-Cookie.
