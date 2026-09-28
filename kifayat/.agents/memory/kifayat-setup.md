---
name: Kifayat project setup
description: Monorepo layout, ports, key env vars, and backend flow fixes applied
---

# Kifayat Project Setup

## Structure
- Monorepo: `kifayat-backend/` (port 5000, Node/Express/MongoDB) + `kifayat-frontend/` (port 5173, Vite/React)
- Auth: httpOnly cookie (`kifayat_token`), NOT localStorage Bearer — `protect` middleware reads from `req.cookies`
- HHC proxy routes mounted at `/api/hhc-proxy` (not `/api/hhc` as older doc says)
- Admin user management at `/api/admin/users` (not `/api/users`)

## Env & Secrets
- All env vars in `kifayat-backend/.env` (protected, cannot edit directly)
- Firebase service account: `kifayat-backend/firebase-service-account.json`
- `FRONTEND_URL` set via Replit shared env var to Replit dev domain (overrides .env localhost value)

## Backend Flow Fixes Applied
- **`orderConEmail` field fix**: `shop.functions.ts` createOrder was sending `email` in shippingDetails; backend reads `shippingDetails.orderConEmail` for the confirmation email recipient. Fixed to send `orderConEmail`.
- **`/confirm-order` page**: Created `kifayat-frontend/src/routes/confirm-order.tsx` — handles token query param, calls `GET /api/orders/confirm/:token`, shows success/expired/error states.
- **ConfirmationGap duplicate index**: Model had `unique: true` on field AND `schema.index({ confirmationToken: 1 })`. Removed field-level unique, kept index-level `{ unique: true }`.

## Cart Design
- Frontend uses localStorage cart (not MongoDB-backed) — this is intentional
- Only `/api/cart/validate` is called from frontend (stock/price check before checkout)
- Backend has full `saveCart`/`getCart` but frontend doesn't use those

**Why:** The design prioritizes client-side cart for performance; backend validate endpoint ensures stock accuracy at checkout time.

## Configuration and AI
- Real `.env` files remain ignored because they contain service credentials; tracked `.env.example` files are the portable/downloadable configuration templates.
- Groq marketplace copy optimization is best-effort during product imports and re-categorization: it improves titles and descriptions, while failed or missing AI calls preserve source copy so imports never fail solely because of AI.
- Verification and transactional email now uses Nodemailer Gmail first, with Resend fallback; the previously configured Resend key was invalid, while Gmail SMTP authentication succeeds.
- Order confirmation links use `PUBLIC_APP_URL` when provided, otherwise the public request origin/forwarded host, with localhost only for local development.
