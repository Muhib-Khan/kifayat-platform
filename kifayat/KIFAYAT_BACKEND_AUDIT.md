# Kifayat Backend — Technical Audit Report

**Scope:** `kifayat-backend` (Node.js / Express 5.2.1 / Mongoose 9.7.2, CommonJS)
**Method:** Full read of all controllers (26), route files (19), middleware, utils, config, key models (35), `server.js`, `package.json`; targeted greps for cross-file claims. Read-only; no code was modified.
**Date:** 2026-08-15

---

## Executive Summary

The codebase is well-structured and thoughtful in places — atomic stock decrements, a transactional admin-cancel path, TTL session indexes, and collision-safe category creation are genuinely good engineering. However, it carries several high-impact defects, the worst of which can **wipe the entire product catalog** (`hhcApiController.syncAll`), **crash an entire admin endpoint** (`csvExportController.downloadPreOrderCSV`, undefined constant), and **silently reset existing product prices to Rs 0** (`productController.uploadCSV`). A cluster of "dead" features (SEO keywords, category-keyword boosting, category editing in `updateProduct`) trace back to a single root cause: fields were never added to the Mongoose schemas, so writes are silently stripped by strict mode. Details and line references in Section 7.

---

## 1. Architecture

### 1.1 Stack & layout
```
kifayat-backend/
├── server.js            Express app, socket.io, startup jobs, graceful shutdown
├── config/              DB, env, constants (deliveryFee default 100, thresholds)
├── models/              35 Mongoose models
├── controllers/         26 controllers
├── routes/              19 route files
├── middleware/          auth, role, requireSameOrigin, rate limiting
├── utils/               email, pricing, categorize, activityLogger, groqKeyPool, tiers
├── scripts/             37 maintenance scripts (probes, backfills, key saving) — not wired to server
└── uploads/defective/   report images/videos (created at boot)
```

### 1.2 Runtime behavior (`server.js`)
- **Port:** default `5000` (`.env` `PORT` overrides). Serves API + static frontend + `robots.txt` handler.
- **Security middleware:** `helmet` + `compression` applied; per-route `express-rate-limit` (global 5000/15 min, auth 15/15 min, OTP 6/15 min); `/api/admin` additionally guarded by `requireSameOrigin`.
- **Socket.io (server.js ≈107–197):** `new Server(server, { cors })` — **no transports restriction server-side** (both polling & websocket allowed; earlier documentation claiming "polling-only" is wrong — that must be a client-side choice). Handshake JWT from `handshake.auth.token` **or** the `kifayat_token` cookie. Anonymous connections allowed (`socket.data.user = null`), but an **invalid/expired token rejects the whole connection** (a stale cookie blocks even anonymous browsing). Rooms are only `defective-<reportId>` for the defective-report chat. `app.set("io", io)` exposes the instance to controllers.
- **Startup jobs:** `restorePendingOnStartup` (products), `autoDiagnostic` (price check every 10 min, first run after 2 min), `activeUserMonitor.startMonitor`, `restorePendingPreOrders`, `startVoucherReservationSweeper` (releases stale 48 h reservations every 15 min).
- **Shutdown:** SIGINT/SIGTERM → graceful close of HTTP + socket servers.

### 1.3 Data & external systems
- **MongoDB** via Mongoose; collections include `products`, `SignupUsers`, `UserSessions`, `orders`, `preorders`, `mainordercsvdatas` (strict:false), `orderhistories`, `settings`, `categories`, `dynamicdatas`, `cancelledorders`, `lateconfirmationorders`, `compensationvouchers`, `discountvouchers`, `purchasedvouchers`, `pricediagnostics`, `priceranges`, `activitylogs`, `loginhistories`, `blockedusers`, `deletedusers`, `userfinaldatas`, `websitereviews`, `defectiveproductreports`, `trendingsearches`, `otps`, `sessions`, `carts`, `reports`, `reviews`, `shippingdetails`.
- **HHC dropshipper API:** proxy with retries/redirects/gzip/br, keep-alive agent (maxSockets 5, timeout 30 s). Handles product listing sync + per-product dynamic data (`/dropshipper/product/slug/<slug>`). Token stored **plaintext** in `Settings`.
- **Groq AI:** key pool (`groqKeyPool`, task-tagged keys, key cycling); used for descriptions, SEO, category fixing, pricing intelligence. Keys stored in `Settings.groqApiKeys` (masked in responses) + legacy `groqApiKey`.
- **Firebase Admin:** Google-auth users; account deletion also removes the Firebase user (best-effort).
- **Email:** Gmail SMTP preferred, Resend fallback; HTML templates built with string interpolation (see 5.8).

### 1.4 Pricing engine (`utils/pricing.js`)
- Priority: **price-range rule → category rule → global %**. Constants: `UNIVERSAL_ADD=150`, `LOW_PRICE_THRESHOLD=500`, `LOW_PRICE_FLAT_ADD=270`; low-price products get flat +270, never a %. `scheduleReprice()` re-runs rules on config changes.
- Customer tiers (`config/tiers.js`): bronze/silver/gold/platinum via order count (0/3/10/25) and spend (0/5000/25000/75000); manual override flag `tierAssignedManually`; per-user `customDiscountPercent`.
- CSV exports use hardcoded `BUSINESS_PROFILE_ID="71823"`, `COURIER_COMPANY="Trax"`; KO-00000001-style sequential order IDs minted from `Settings.mainCSVCustomOrderId`.

---

## 2. API Surface (by domain)

> Representative endpoints; exact verbs/paths live in the route files. Public = no auth; **Auth** = any signed-in user; **Admin** = admin role (+ `requireSameOrigin` on `/api/admin`).

| Domain | Representative endpoints | Access | Notable behavior / quirk |
|---|---|---|---|
| **Auth** | `/api/auth/register, login, google, verify-otp, forgot-password, reset-password, change-password, profile, delete-account, status, sessions, refresh-token` | Public/Auth | OTP hashed (sha256), 10-min expiry; cookie `kifayat_token` httpOnly 30 d, `sameSite=none` in prod; password reset/forgot ARE implemented |
| **Products** | `/api/products`, `/:id`, `/:id/similar`, `suggestions`, `trending-searches`, `leaderboard`, `report`, `stats` — public; admin: `upload-csv`, `create-manual`, `update-stock`, `update`, `delete`, `pricing-by-category`, `pricing-all`, `out-of-stock`, `categories`, `category-image`, `product-orders`, `recategorize`, `featured-landing`, `featured-count`, `set-featured-order` | Public / Admin | `toPublicObject` strips `wholesalePrice`; **category-keyword boost never fires** (see F4); **existing-product prices reset to 0 on CSV upload** (F3); **category not updatable via PUT** (F5) |
| **Cart** | `/api/cart` (get/save), `/api/cart/validate` | Auth | Validate resolves by `_id` **or slug** (stale-id healing), variation-aware availability |
| **Orders** | `/api/orders` (place), `/api/orders/confirm/:token`, `/api/orders/my`; admin finalize | Public (token) / Auth / Admin | Confirm link is public bearer token; 24 h `confirmationExpiresAt` on PreOrder (see §3) |
| **Order workflow** | `/api/workflow/*`: `pending-preorders`, `confirm-preorder/:token`, `assign-to-hhc`, `handle-stock-exhaustion`, `remove-low-stock`, `cancel-orders`, `cancel-order-system` | Public (token) / Admin | **Second public confirm flow coexists** with orders confirm; `STOCK_THRESHOLD=15` while comments say 50 (F9) |
| **Reviews** | `/api/reviews` (list/create/eligibility), admin pin/list | Auth / Admin | Eligibility: **any authenticated user can review any product** — no purchase verification (F10) |
| **Website reviews** | `/api/website-reviews` (public list, auth create), admin update/delete/pin | Public / Auth / Admin | Enriches reviews with buyer's latest courier city from ShippingDetail |
| **Vouchers** | `/api/vouchers`: shop, buy, apply, my; admin CRUD | Auth / Admin | Buy = transaction, points + priceMultiplier deducted, **DiscountVoucher deleted on purchase**; admin list flags vouchers older than 2 min as "Ended" (visibility-window quirk) |
| **Categories** | `/api/categories` (public), admin create/image | Public / Admin | Slug auto-gen; collision-safe `findOrCreateCategory` with numeric suffix retries |
| **Price ranges** | `/api/price-ranges` CRUD, `/api/price-ranges/:id/products` | Admin | Overlap rejection on create; `MAX_PRICE=1e9`; triggers `scheduleReprice` |
| **Settings** | `/api/admin/settings`, `delivery-fee`, `hero-objects`, `groq-keys` (+add/update/delete/test) | Admin | Keys masked in responses; live Groq ping test |
| **HHC proxy** | `/api/hhc-proxy/sync`, `sync-dynamic-all`, `status`, `stop`, `save-products`, `proxy/*` | Admin | In-memory sync state; **full catalog wipe risk** (F1); dynamic sync writes Product imageUrl/variations/stock |
| **Dynamic data** | `/api/dynamic-data` (public slug), admin refresh | Public / Admin | Upserts `DynamicData` (unique slug) |
| **Defective products** | `/api/defective-products`: submit, list, detail, status, chat | Auth / Admin | Requires ≥3 photos + ≥1 unboxing video; chat emits socket events to `defective-<id>` room |
| **AI admin** | `/api/ai/*`: seo-booster (start/status), category-fixer, pricing-intelligence | Admin | Background jobs with in-memory state; **SEO Booster writes are a silent no-op** (F4) |
| **Admin core** | `/api/admin/diagnostic` (run, latest, **confirm/:token — public email link**, resolve), `activity-logs` (+stats), `users` (list/history/delete/block/status/time-stats/tier/discount), `user-final-data`, `compensation-vouchers`, csv `download-main`, `download-preorder` | Admin (except diagnostic confirm) | **`download-preorder` always 500s** (F2); auto-diagnostic sends 3 emails then auto-applies global pricing after 9 min if unacknowledged |
| **Catalog maintenance** | `/api/catalog/*` (sweep, slug, dynamic refresh) | Admin | Manual triggers for Grand Sync phases |
| **Search** | suggestions + trending-searches (products), user search via `$regex` | Public / Admin | User/cancel-order `q` filters use **unescaped `$regex`** (ReDoS-leaning, F10-ish) |

---

## 3. Order Lifecycle Trace

1. **Place order** (`orderController.placeOrder`)
   - Validates items; **per-item atomic stock check** via `findOneAndUpdate({ stock: { $gte: qty } }, { $inc: { stock: -qty } })` — no oversell.
   - Creates `Order` (with shipping) **and** `PreOrder` (`status: pending`, `confirmationToken` = 32-byte hex, `confirmationExpiresAt` = 24 h). Sends confirmation email (link → frontend `/confirm-order?token=…`).
   - `schedulePreOrderCancellation` sets an **in-memory** 24 h timeout (lost on restart; `restorePendingPreOrders` re-links on boot, so overdue-but-unprocessed pre-orders still auto-cancel after restart).
2. **Confirm (public GET `/api/orders/confirm/:token`)** — no threshold
   - Token lookup on PreOrder; expired/invalid → error page. On success: `createConfirmedOrderExports` **upserts `MainOrderCSVData`** (`orderID` unique, `exported: false`, token preserved for idempotency) and **deletes the original Order + ShippingDetail**. The order is now in the export pool.
3. **Confirm (alternative public GET `/api/workflow/confirm-preorder/:token`)** — thresholded
   - Same path, but if any item stock < `STOCK_THRESHOLD` (15) → `LateConfirmationOrder` + **stock restore** + voucher restore + email. **Two divergent public confirm flows coexist**; a buyer may hit either depending on which link/UI is used.
4. **Admin workflow** (`orderWorkflowController`)
   - `confirmPreOrderWithThreshold` (admin) → same threshold behavior as #3.
   - `assignToHHC`: final stock/price re-check; on failure the order is removed from `main_orders`, emailed, archived to `cancelledorders`, vouchers restored — but **stock is NOT restored**.
   - `handleStockExhaustion` / `removeLowStockOrder`: archive to cancel orders, no stock restore.
   - `adminCancelOrderSystem`: **the only MongoDB-transactional path** — restores vouchers, archives, but **also does NOT restore stock**.
   - `updateOrderStatus` (admin) cancel: archives but **does not restore stock** — inconsistent with user-cancel flows.
5. **User cancel / auto-cancel**
   - `cancelOrder` (link) and the 24 h auto-cancel both → `CancelledOrders` + **stock restore** + voucher restore. (This is the only place stock is consistently restored.)
6. **CSV export** (`csvExportController`)
   - `downloadMainCSV`: snapshot → resolve HHC ids → sequential `KO-00000001` ids (counter `$inc` by orderCount in `Settings`) → mark exported → build padded CSV → archive into `OrderHistory` (`insertMany ordered:false`, dup-ignored) → `deleteMany` → stream.
   - Not atomic but self-healing (snapshot, not exported-filtered). Risks: **two concurrent exports mint duplicate KO ids**; a crash between archive and deleteMany leaves duplicate archive rows with different KO ids.
   - `downloadPreOrderCSV`: **always crashes** — line 537 references `BUSINESS_PROFILE_DEFAULT`, defined nowhere (F2).

---

## 4. Code Quality

**Good patterns**
- Controllers/routes/models/utils separation is consistent; handlers share try/catch + JSON-error shapes; pagination is uniform (`page/limit/skip + total`).
- Input validation is genuinely careful in places: ObjectId regex checks, price bounds (`MAX_PRICE=1e9`), price-range overlap rejection, discount 0–100 bounds, tier enum checks, array caps (e.g., `setFeaturedOrder` ≤ 500 ids).
- Data hygiene: `toPublicObject` strips `wholesalePrice`/`uploadBatch`; `User.toSafeObject` strips password/otp/token; Groq keys masked in settings responses.
- Operational: TTL indexes on Session/Otp; login history; activity logging; graceful shutdown; socket room isolation per defective report; rate limiting on sensitive endpoints.

**Weak spots**
- **Dead code / dead features:** `normalizeOrderItems` (orderController) unused; `ConfirmationGap` model + `CancelledOrders.originalConfirmationGapId` vestigial; `randomDelay` dead var (hhcApiController); category pricing block in `updateProduct` (1331–1347) unreachable; **SEO `keywords` writes silently stripped** (F4).
- **Unused dependencies** (grep of `require()`): `node-cron`, `qrcode-terminal`, `json2csv`, `date-fns`, `cloudinary`, `mongodb` never required. (`uuid`, `csv-parser`, `compression`, `helmet` are used.)
- **Audit-log call bugs:** `userController.setUserTier` (line 401), `setUserDiscount` (421), `resetUserTierAuto` (445) call `logActivity(req.user._id, ACTIONS.ADMIN_ACTION, …)` but `logActivity` destructures an **options object** (`activityLogger.js:13`) → every call logs a junk entry with all fields undefined (F8).
- **Mixed logActivity usage** elsewhere (correct object form in userController delete/block; user-object form in activityLogController).
- **Regex from user input:** `getCancelOrdersFiltered` (`$regex` on `q`), `getUsers`, `getUserFinalData`, admin review search — unescaped user-controlled regex patterns (ReDoS-leaning; low-to-medium since admin-only except public search paths).
- **N+1 / unbounded loops:** `generateUserFinalData` loops users with 3 queries each; `getLowStockOrders` N+1 and no pagination; `getReports` paginates via `.skip` with un-clamped limit.
- **In-memory timers** (pre-order cancellation, diagnostic reminders, sync state) are process-local — multiple instances/restarts lose them; the diagnostic reminder timers don't survive restarts (spam guard prevents duplicates within 2 h, so impact is limited).
- **Index gaps:** no index on `confirmationToken` (PreOrder / CancelledOrders / MainOrderCSVData) → collection scan per confirmation; `Order` `{user, clientRequestId}` index is **non-unique** → idempotency depends on an app-level check (F6); `OrderHistory.orderID` unindexed.
- **Comments vs code drift:** `STOCK_THRESHOLD=15` with "50" in comments (F9); memory docs claimed 10-min token (actually 24 h), 31 models (actually 35), polling-only sockets (wrong — see 1.2).

---

## 5. Business-Logic Risks

1. **Catalog wipe on HHC hiccup (CRITICAL, F1).** `syncAll` treats an empty page (>1) or ≥3 consecutive fetch failures as "end of catalog", breaks the loop, and Phase 4 then deletes **every product with `newProduct != true`**. A transient HHC outage mid-sync can delete the whole storefront catalog.
2. **Price reset to 0 on CSV upload (HIGH, F3).** Re-importing a CSV `$set`s existing products' `retailPrice` to 0 (mapRow line 275) and applies pricing rules only in the new-product branch — repricing an existing catalog silently zeroes prices until the price diagnostic/auto-apply catches up (and only for products with `wholesalePrice > 0`).
3. **Pre-order CSV export permanently broken (HIGH, F2).** `BUSINESS_PROFILE_DEFAULT` is referenced but never defined → every call throws `ReferenceError` → 500.
4. **Keyword features are all silent no-ops (HIGH-MED, F4).** Product & Category schemas have no `keywords` field; mongoose strict mode strips the SEO Booster's `$set: { keywords }` (aiController:375) and the `CATEGORY_KEYWORDS` map (productController:28) is `[slug, undefined]`, so category-keyword boosting (669–681, 739–745) never runs. The SEO job "completes" claiming `N products keyworded` forever.
5. **Category cannot be changed via admin edit (MED-HIGH, F5).** `updateProduct`'s allowed-field list omits `category`; the adjacent category-repricing block (1331–1347) is unreachable. Admins must re-upload CSVs to fix categories.
6. **Order idempotency race (MED, F6).** `{user, clientRequestId}` is not unique, so two concurrent identical POSTs can create two orders + two PreOrders. Similarly, concurrent CSV exports mint duplicate `KO-…` ids.
7. **Stock restore inconsistency (MED, F7).** Admin cancel (`updateOrderStatus`), `assignToHHC` failure, stock exhaustion, low-stock removal, and `adminCancelOrderSystem` never restore stock, while user-cancel/auto-cancel do → inventory leaks.
8. **Audit trail gaps (MED, F8).** Tier/discount changes log garbage entries (wrong `logActivity` signature) — compliance/audit value lost.
9. **Dual confirmation flows + threshold mismatch (LOW-MED, F9).** Two public confirm endpoints behave differently (threshold 15 vs none); a buyer's confirmation outcome can differ by which link they used; docs/comments disagree on the intended threshold.
10. **Trust/verification gaps (LOW-MED).** `checkReviewEligibility` grants any signed-in user `canReview: true` without purchase proof → fake reviews. `getUserStatus` (public) leaks blocked/deleted status by email (enumeration). Diagnostic confirm link sets `acknowledgedBy = req.query.email` (spoofable). Socket connection is rejected entirely on invalid token (stale cookie blocks chat/anonymous).
11. **Email & URL hygiene (LOW-MED).** Product/customer names interpolated into HTML emails **without escaping** (stored-XSS-in-mail); confirmation/diagnostic URLs fall back to `http://localhost:5000` / `:5173` when env vars are unset → broken prod links. HHC token stored plaintext in `Settings`.
12. **Pricing trust chain.** HHC sync writes `retailPrice = rawPrice` (wholesale) and Phase 6 reprices; if **no pricing rules are configured, the store sells at cost**. Auto-diagnostic silently applies global pricing 9 min after 3 reminder emails if unacknowledged.

---

## 6. Strengths

- **No oversell:** per-item atomic `findOneAndUpdate` stock check at order time.
- **Transaction discipline where it matters most:** `adminCancelOrderSystem` uses a real MongoDB session/transaction (the only fully transactional write path).
- **Good data hygiene:** wholesale price stripped from public payloads; safe-object serializers; masked API keys; best-effort activity logging that never breaks the main operation.
- **Defensive schema UX:** collision-safe category creation (unique-slug retries), TTL indexes for sessions/OTPs, `strict:false` on export-parity collections, sparse unique `{order:1}` on PreOrder.
- **Validation rigor in hot spots:** cart validate resolves stale ids by slug; price-range overlap rejection; bounded lists (featured order ≤500, review limit ≤50, user limit ≤100).
- **Ops hardening:** graceful shutdown, per-route rate limits, `requireSameOrigin` on admin API, helmet/compression, keep-alive proxy agent with retries, self-healing (snapshot-based) CSV export, email spam guard (2 h window) for diagnostics.
- **Observability hooks:** activity logs with IP/UA, login history, session duration stats with interval merging, price diagnostics with auto-apply, socket events for live chat.

---

## 7. Top 10 Findings (priority order)

| # | Severity | Finding | Location | Impact |
|---|---|---|---|---|
| 1 | **CRITICAL** | `syncAll` breaks on empty page (>1) or ≥3 consecutive fetch failures, then Phase 4 deletes **all** products with `newProduct != true` — a transient HHC outage wipes the catalog | `controllers/hhcApiController.js` (syncAll, ≈843–845 → Phase 4 delete) | Full storefront catalog loss |
| 2 | **HIGH** | `downloadPreOrderCSV` references undefined `BUSINESS_PROFILE_DEFAULT` | `controllers/csvExportController.js:537` | Endpoint always 500s (ReferenceError) |
| 3 | **HIGH** | CSV upload `$set`s `retailPrice: 0` on existing products; pricing rules only applied in new-product branch | `controllers/productController.js:275`, ≈373–387 | Existing products priced at Rs 0 on re-import |
| 4 | **HIGH-MED** | SEO `keywords` writes silently stripped (field absent from `Product` schema, strict mode); `CATEGORY_KEYWORDS` built from non-existent `Category.keywords` → category boost never fires | `controllers/aiController.js:375`; `models/Product.js`; `models/Category.js`; `controllers/productController.js:28, 669–681, 739–745` | Dead SEO feature + dead search boost; infinite re-processing |
| 5 | **MED-HIGH** | `updateProduct` allowed-fields excludes `category`; category-repricing block 1331–1347 unreachable | `controllers/productController.js:1321–1347` | Admins can't change category/pricing by category via API |
| 6 | **MED** | `{user, clientRequestId}` index **not unique** → concurrent duplicate orders; concurrent CSV exports mint duplicate KO ids | `models/Order.js`; `controllers/csvExportController.js` | Duplicate orders / duplicate export ids |
| 7 | **MED** | Admin/workflow cancellations never restore stock (unlike user/auto-cancel) | `orderController.updateOrderStatus`; `orderWorkflowController` (assignToHHC, handleStockExhaustion, removeLowStockOrder, adminCancelOrderSystem) | Inventory leaks |
| 8 | **MED** | `logActivity(req.user._id, …)` called with wrong signature → junk audit entries for tier/discount changes | `controllers/userController.js:401, 421, 445` vs `utils/activityLogger.js:13` | Broken audit trail |
| 9 | **LOW-MED** | Two divergent public confirm flows (`/api/orders/confirm/:token` no-threshold vs `/api/workflow/confirm-preorder/:token` threshold 15) + comment says 50 | `orderController.confirmOrder`; `orderWorkflowController.js:22` | Inconsistent confirmation outcomes; drift between code & intent |
| 10 | **LOW-MED** | Unescaped user/product names in HTML emails + env-unset URL fallbacks to localhost; unindexed `confirmationToken` lookups; unescaped `$regex` on user `q` filters | `utils/email.js` (getConfirmationBaseUrl); `diagnosticController.js:272–276`; `PreOrder/CancelledOrders/MainOrderCSVData` (no token index); `orderWorkflowController.getCancelOrdersFiltered` | Email XSS/low, broken prod links, O(n) confirm lookups, ReDoS-leaning |

**Honorable mentions:** review eligibility without purchase check; `getUserStatus` account enumeration; diagnostic confirm `?email=` spoofing; socket rejected on invalid token; HHC token plaintext in Settings; sell-at-cost if no pricing rules configured; unused deps (`node-cron`, `qrcode-terminal`, `json2csv`, `date-fns`, `cloudinary`, `mongodb`); vestigial `ConfirmationGap` model.

---

### Suggested remediation order
1. **F1 first** — make sync failure/empty-page abort safe (skip cleanup on error, require explicit `nextPage`/cursor or stable last-page marker before Phase 4).
2. Fix F2 (define/remove `BUSINESS_PROFILE_DEFAULT`) and F3 (only `$set` price when actually changing it; price existing products too).
3. Decide the `keywords` story (add fields to schemas or delete the features) — resolves F4 and the CATEGORY_KEYWORDS dead code in one move.
4. Add `category` to `updateProduct` allowed fields; add unique indexes for `clientRequestId` and `confirmationToken`; make stock restore consistent across all cancel paths; fix the `logActivity` calls; escape email HTML and set fail-safe production URLs.
