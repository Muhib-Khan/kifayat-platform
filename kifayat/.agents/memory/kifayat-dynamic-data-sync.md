# Kifayat — Dynamic Data (per-product fetch, replaces global sync — Aug 2026)

Feature: fetch the HHC dynamic product API for a single product's slug and store/update the response in the DynamicData collection, enrich the product with multiple images, videos and variations, and show all of it on the storefront product page.

## Backend
- **Model** `kifayat-backend/models/DynamicData.js` — collection `dynamicdata`. Fields: `slug` (required, unique), `product` (ref Product), `productId`, `name`, `rawData` (Mixed — full API response), `images` [String], `videos` [String], `variations` (Mixed), `gallery` [{id,url,type}] (ordered media), `fetchedAt`, timestamps.
- **Model** `kifayat-backend/models/Product.js` — added `variations` (Mixed, default []) and `gallery` ([Mixed], default []) — filled only by the per-product fetch. `imageUrl` stays comma-joined (existing storefront convention, first URL = primary).
- **Controller** `kifayat-backend/controllers/dynamicDataController.js` — exports `fetchProductDynamicData` (route), `fetchAndSaveDynamicData` (shared logic), `extractImages`, `extractGallery`.
  - Reads the product's existing `slug` field from the Products collection (by Mongo `_id`).
  - Reuses `proxyRequest` (3 retries w/ exponential backoff + follows up to 3 redirects, 301/302/307/308 via Location header — added Aug 2026) + `resolveHhcToken` imported from `hhcApiController`.
  - Endpoint: `{HHC_API_URL}/dropshipper/product/slug/<slug>` (encodeURIComponent'd slug) — matches `https://member.hhcdropshipping.com/api/dropshipper/product/slug/<slug>`.
  - `extractGallery(data)`: thumbnail first (image), then product_galleries; video types = mp4/mov/webm/m4v/avi, image types = jpe?g/png/webp/gif/avif/bmp; everything else skipped; deduped by URL; keeps HHC media `id` so `variationImgID` can be mapped to a gallery image.
  - Persists: `Product.imageUrl` = comma-joined image URLs (only overwritten when images exist), `Product.variations`, `Product.gallery`; DynamicData upsert by `slug` (findOne → update, else create) — no duplicates; existing records updated.
  - Requires a saved HHC bearer token (Settings.hhcToken); errors if none is saved (admin saves it once on the HHC Sync page). Non-200 HHC responses → 400/502 with the HHC response body snippet included in the message (self-diagnosing, e.g. 422s).
- **Route** in `kifayat-backend/routes/hhcApiRoutes.js` (mount `/api/hhc-proxy`):
  - `POST /product-dynamic-data/:id` (protect+admin) — `:id` is the product Mongo `_id`.
- **Admin product list** `GET /api/products/admin-list` (`getAdminProducts` in `productController.js`) attaches `dynamicDataFetched` (bool) + `dynamicDataFetchedAt` (date|null) to each product (matched via DynamicData `product` ref or `productId`), additive-only.
- Customer product detail `GET /api/products/:id` (`getProductById` + `toCustomerProduct`) passes `gallery`, `variations`, `videos` through untouched (only `stock`/`newProduct`/`rawData`/`hidden` stripped).

## Frontend
- `src/lib/api.ts`: `UIProduct` extended with `image_urls: string[]`, `videos: string[]`, `variations: any[]`, `gallery: {id,url,type}[]`; `normalizeProduct` derives them from the backend `gallery`/`videos`/`variations` (falls back to splitting comma-joined `imageUrl`).
- `src/lib/admin.functions.ts`: `adminFetchProductDynamicData(productId)` → `POST /hhc-proxy/product-dynamic-data/:id`.
- `src/routes/_authenticated/admin.products.tsx`: "Get Product Dynamic Data" button on every product row (always enabled, can re-click to refresh; spinner while fetching). Green "Dynamic data fetched" badge with fetchedAt tooltip when `dynamicDataFetched` is true — informational only, never disables the button.
- `src/routes/_authenticated/admin.hhc.tsx`: global "Dynamic Data Sync" button, progress panel, socket listener and handlers removed. HHC Sync All, Quick Fetch and Re-categorize DB are unchanged.
- `src/routes/products.$productId.tsx` (storefront product page):
  - Gallery = images then videos (from `product.gallery`); main pane renders `<video controls>` for videos, ZoomImage for images; thumbnail strip shows play badges on videos; Lightbox stays images-only (gallery index → image index mapped).
  - "§ Options" section renders variation buttons (label = part after last `|` / ` - `); selecting one updates the displayed price (`salePrice ?? price ?? product.price`), stock badge (variation `quantity > 0`) and switches the main image when `variationImgID` matches a gallery item `id`.

## Notes
- The old global sync (`sync-dynamic-data`, `dynamic-sync-status`, `dynamic-sync-stop`, `dynamic_data_progress` socket event) was removed entirely; no other code referenced DynamicData.
- HHC gallery `original_url` extension may be truncated (e.g. `.jpe` for jpeg) — classify videos by their `.mp4`/etc. extension first; unknown files are skipped.
- Uses same bearer token (localStorage `hhc_token` / server-saved Settings.hhcToken) as HHC sync. HHC returns 403 for invalid tokens, 404 for products removed from HHC (e.g. `womens-mini-wallet`, `solar-wall-lamp`), 422 for HHC-side validation (body now surfaced in the error).
- Diagnostic scripts in `kifayat-backend/scripts/`: `debug_hhc_slug.js`, `verify_dynamic_data.js`, `find_variation_product.js`, `find_422_case.js`, `refresh_wallet_dynamic.js` (all require `dotenv` + mongoose connection — always `mongoose.connect` before `resolveHhcToken`, else it silently returns "").
- Verified: `node --check` all backend files, `tsc --noEmit`, `npm run lint`, `npm run build` all pass.
