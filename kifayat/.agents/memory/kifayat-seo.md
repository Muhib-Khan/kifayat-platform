---
name: Kifayat SEO system
description: Full SEO stack implemented — react-helmet-async, JSON-LD, sitemaps. Key decisions and file locations.
---

# Kifayat SEO System

## Head management
- `react-helmet-async` installed and `HelmetProvider` wraps the app in `main.tsx`
- Core SEO component: `src/components/seo/SEO.tsx` — title template, description, canonical, OG, Twitter Card, robots
- JSON-LD helpers: `src/components/seo/JsonLd.tsx` — WebSite, Organization, Product, Breadcrumb, ItemList, Article, FAQ, LocalBusiness schemas
- TanStack Router's `head:` API was **not** used (requires `HeadContent` in `__root.tsx` which wasn't set up). react-helmet-async was chosen for reliability.

## Per-route SEO coverage
- `/` — WebSiteSchema (SearchAction sitelinks), OrganizationSchema
- `/products/$productId` — ProductSchema (with price, availability, offers), BreadcrumbSchema — uses `product.id` not `product.slug`
- `/products/` — ItemListSchema, BreadcrumbSchema
- `/category/$slug` — ItemListSchema, BreadcrumbSchema, dynamic title/description
- `/search` — dynamic title from query param; `noindex` when query is empty
- `/blog/$postId` — ArticleSchema, BreadcrumbSchema
- `/faq` — FAQSchema (all Q&A groups flattened)
- `/about` — OrganizationSchema
- `/contact` — LocalBusinessSchema

## Sitemap architecture (backend)
- `GET /sitemap.xml` — sitemap index, points to 4 sub-sitemaps
- `GET /sitemap-pages.xml` — 10 static pages with priority/changefreq
- `GET /sitemap-products.xml` — all in-stock products, URL is `/products/:_id` (not `/product/:slug`)
- `GET /sitemap-categories.xml` — all Category docs
- `GET /image-sitemap.xml` — existing image sitemap (unchanged)
- All sitemaps cache for 1 hour; `FRONTEND_URL` env var drives the domain

**Why:** Split sitemap index is required by Google for catalogs > 50k URLs and allows per-section `lastmod`.

## UIProduct nullability note
- `brand`, `image_url`, `description`, `old_price`, `sku` can all be `null` on UIProduct
- When passing to SEO/JsonLd components, convert with `?? undefined`
- UIProduct does NOT have `reviewCount` or `rating` fields — don't reference them
