---
name: Kifayat backend audit
description: Gaps found and fixed between the original spec and actual backend implementation.
---

## Confirmed Gaps Fixed

1. **getShipmentEmails response format** — Frontend (checkout.tsx) expects `{ loginEmail, shipmentEmails }` (separate fields); backend was returning `{ shipmentEmails: [all combined] }`. Fixed in authController.js.

2. **phone field missing from User schema** — Frontend reads/writes `user.phone` via GET /auth/me and PUT /auth/profile. Added `phone` field to `models/User.js`.

3. **updateProfile rejected phone** — Joi schema only allowed name/gender/newEmail. Added `phone` to Joi schema and save logic in authController.js.

4. **Review.js missing order field** — Docs specify `order: ObjectId → Order` for linking reviews to purchases. Added as optional (default: null) to `models/Review.js`.

## Known Design Divergences (intentional, not bugs)

- **Cart** — Docs spec individual add/remove/clear; actual impl uses localStorage-only cart with `POST /api/cart` (full save) + `POST /api/cart/validate` (price check). Frontend is consistent with this design.
- **toCustomerProduct()** — Docs say model method; actual impl is a standalone function in productController.js. Functionally equivalent.
- **adminRoutes.js** — Docs show single file; split across csvExportRoutes.js + userRoutes.js, all correctly mounted in server.js.
- **forgotPassword / resetPassword** — Not implemented on backend or frontend. Feature was never built; not a regression.

## Confirmed Working (matches docs)
- Full order lifecycle: placeOrder → ConfirmationGap → processConfirmationGap → PreOrder/CancelledOrders/MainOrderCSVData
- CSV export: atomic claim, dynamic headers, OrderHistory archive, delete from MainOrderCSVData
- restorePendingConfirmations() called on server startup
- All HHC sync: syncAll, quickFetch, rate limiting (5-7s delay, 10-page batches), 5-min grace period, cleanup
- All route mounting in server.js
- Socket.IO events (products_updated, product_deleted, hhc_progress, sync_complete)
- Firebase Admin: file path → env var JSON → fallback project ID
