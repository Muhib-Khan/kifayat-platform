# Get Kifayat Indexed & Ranked — Action Guide

This guide walks you through getting https://kifayat.co into Google: verifying the site in Google Search Console, submitting sitemaps, cleaning up www and old-domain redirects, then a 15-minute weekly routine to grow traffic. It is written for the store owner — every step is a dashboard click, no code required.

## 0. Two things to know before you start

- **Backend availability risk.** Your sitemaps and product data are served by the backend (Northflank, via the Vercel `/api` rewrite). If the backend service goes down or its URL changes, the sitemaps stop responding and product pages can break. If you ever see sitemaps failing, check the backend health endpoint (`/api/health`) first. Hosting details are in BACKEND-HOSTING.md.
- **robots.txt already allows /blog/, but no blog pages exist yet.** This is harmless today — Google finds nothing to crawl there. It becomes relevant when the blog launches (see CONTENT-PLAN.md).

---

## 1. Week 1 — Google Search Console (step-by-step)

### 1.1 Add the Domain property for kifayat.co

1. Go to https://search.google.com/search-console and click **Start now** (or **Add property**).
2. Sign in with a Google account you will keep long-term — ideally the one tied to the business email. This account becomes your SEO dashboard.
3. Choose property type **Domain**.
4. Type `kifayat.co` exactly. No `https://`, no `www`, no path.
5. Google shows a verification record — a TXT value that looks like `google-site-verification=XXXXXXXX`. Leave this tab open.

### 1.2 Add the TXT record at GoDaddy

1. Sign in at https://www.godaddy.com.
2. Go to **My Products** → **Domains**.
3. Click **DNS** (some accounts show **Manage DNS**) next to `kifayat.co`.
4. On the **DNS Management** page, scroll to the **Records** section.
5. Click **Add New Record**.
6. Fill in the fields:
   - **Type:** TXT
   - **Name (Host):** leave as `@` (the root of the domain)
   - **Value:** paste the full `google-site-verification=...` string from Search Console
   - **TTL:** leave the default (1 hour)
7. Click **Save**.
8. Back in Google Search Console, click **Verify**. DNS changes can take a few minutes to a few hours. If verification fails, wait 30 minutes and click **Verify** again.

### 1.3 Add the URL-prefix property for https://www.kifayat.co

1. In Search Console, click the property picker (top-left) → **Add property**.
2. Choose **URL prefix**.
3. Enter `https://www.kifayat.co/` (with `https://` and the trailing slash).
4. Pick the **DNS** verification method — the TXT record from step 1.2 already exists at the root of the domain, so this property verifies instantly.
5. You now have two properties, and that is fine:
   - The **Domain property** tracks every form of the domain (http, https, www, subdomains).
   - The **URL-prefix property** (the `www` one) is where you submit sitemaps and request indexing.

### 1.4 Submit the five sitemaps

1. Open the `https://www.kifayat.co` URL-prefix property.
2. In the left menu, click **Sitemaps**.
3. Paste each of the five URLs below into **Add a new sitemap** and click **Submit**, one at a time:

```
https://www.kifayat.co/sitemap.xml
https://www.kifayat.co/sitemap-pages.xml
https://www.kifayat.co/sitemap-products.xml
https://www.kifayat.co/sitemap-categories.xml
https://www.kifayat.co/image-sitemap.xml
```

4. After a few minutes, the **Status** column should read **Success** for each sitemap. Click **View sitemap** on `sitemap-products.xml` to confirm it lists your products.
5. If any sitemap shows **Couldn't fetch**, the URL returned an error — see section 3 and the backend risk note in section 0.

### 1.5 Request indexing for the homepage and category pages

1. Open the **URL Inspection** tool (the search box at the top of any Search Console page).
2. Paste `https://www.kifayat.co/` and press Enter.
3. Click **Test Live URL**, wait for the result, then click **Request indexing**.
4. Repeat for the main category pages:

```
https://www.kifayat.co/category/electronics
https://www.kifayat.co/category/fashion
https://www.kifayat.co/category/home-kitchen
https://www.kifayat.co/category/beauty
```

5. Add one more category from your live store — the URL pattern is `/category/<slug>` — so you request the homepage plus five category pages.
6. Google caps how many indexing requests you can submit per day. Do 5–6 URLs a day max; everything else is picked up from the sitemaps anyway.

Note: **Request indexing** is a nudge, not a guarantee. If a URL stays "Not indexed", the page is usually too thin or too new — add content and re-request later, don't spam the button.

---

## 2. Week 1 — www and old-domain cleanup

### 2.1 The decision: keep https://www.kifayat.co as the only canonical

The site already uses **www** consistently — in its canonicals, sitemaps, robots.txt, and structured data — and the apex `kifayat.co` issues a 308 redirect to `www.kifayat.co`. That is the correct, consistent setup: keep it. Do NOT redirect `www` back to the apex, and do not submit `https://kifayat.co` (apex) as a separate sitemap — everything already resolves to `www`.

### 2.2 Verify the apex → www redirect is working

1. Open https://kifayat.co in a browser — you should land on https://www.kifayat.co.
2. In Google Search Console, the **Domain property** for `kifayat.co` already tracks all forms of the domain (http, https, www, apex), so you only need the one property. Submit sitemaps using the `www` URLs:
   - https://www.kifayat.co/sitemap.xml
   - https://www.kifayat.co/sitemap-pages.xml
   - https://www.kifayat.co/sitemap-products.xml
   - https://www.kifayat.co/sitemap-categories.xml
   - https://www.kifayat.co/image-sitemap.xml
3. If the redirect ever breaks, fix it at Vercel: **Settings → Domains → `kifayat.co` → Edit → Redirect to `www.kifayat.co` (301/308)**.

### 2.3 Old domain: forward kifayat.com → kifayat.co (if you still own it)

Old kifayat.com links may still be circulating. If the domain is registered at GoDaddy:

1. GoDaddy → **My Products** → **Domains** → `kifayat.com` → **Manage DNS**.
2. Go to **Forwarding** → **Add Forwarding**.
3. Forward the domain (and `www`) to `https://kifayat.co`.
4. Type: **Permanent (301)**. Masking: **off**.
5. If you no longer own it, just make sure all new material (packaging, ads, social bios) says kifayat.co.

---

## 3. Week 1 — robots.txt and sitemap sanity check

### 3.1 Open each sitemap in a browser

Visit each URL below. Each should show an XML document — either a sitemap index or a list of page URLs:

```
https://www.kifayat.co/sitemap.xml
https://www.kifayat.co/sitemap-pages.xml
https://www.kifayat.co/sitemap-products.xml
https://www.kifayat.co/sitemap-categories.xml
https://www.kifayat.co/image-sitemap.xml
```

### 3.2 Check robots.txt

Open https://www.kifayat.co/robots.txt. It should load as plain text and end with the five `Sitemap:` lines. Two things to note:

- It allows `/blog/`, but no blog pages exist yet. When the blog launches (CONTENT-PLAN.md), make sure every `/blog/` page returns real content — empty shells cause "soft 404" errors in Search Console.
- `/api/` is disallowed, which is fine: the sitemaps live at root URLs, not under `/api/`, so the rule does not block them.

### 3.3 If a sitemap returns an empty page or an error

The frontend serves an empty stub for `/sitemap.xml`; the real XML comes from the backend (Northflank, proxied via the Vercel `/api` rewrite). An empty page or error therefore almost always means the backend is down or unreachable — check the backend health endpoint (`/api/health`) first. Also paste one product URL from `sitemap-products.xml` into the URL Inspection tool to confirm a real product page resolves.

### 3.4 Crawl stats (optional 1-minute glance)

Search Console → **Settings** → **Crawl stats** shows how many requests Google makes and how many it can fetch. Early on, the numbers are small — that is normal. Only pay attention if you see a sharp drop after changing robots.txt or server settings. Crawl rate is not a ranking metric.

---

## 4. Weekly monitoring routine (15 minutes)

Do this every week, same day if possible. Skip week 1 if data is still too thin — start in week 2 or 3.

### 4.1 Performance → Queries (5 minutes)

1. Search Console → **Performance** → **Search results**. Set the date range to **Last 28 days**.
2. Open the **Queries** tab.
3. Sort by **Position** and scan the range from position 5 to 20. These are your **near-wins**: pages already on the first page of results for a term. Improve the page and watch it climb.
4. Now sort by **Impressions**. Queries with high impressions but zero clicks are **content gaps**: you appear for the search, but nobody clicks. Fix the snippet (title/description) or make the page itself more useful.

Plain language: **Position** = what rank you show up in. **Impressions** = how many times you were shown. **Clicks** = how many times people actually visited. **CTR** = clicks ÷ impressions, i.e. how good your result looks next to competitors.

### 4.2 Indexing → Pages report (5 minutes)

1. Search Console → **Indexing** → **Pages** (this report used to be called **Coverage**).
2. Look at the **Error** rows first. Common ones and what they mean:
   - **Page with redirect** — a page 301s somewhere unexpected. Check the www/old-domain changes from section 2.
   - **Soft 404** — a page returns "found" but is empty, typically an out-of-stock product page. Remove the page or give it real content.
   - **Not found (404)** — a dead link. Fix the link or let the 404 stand.
3. **Crawled – currently not indexed** is normal for a young site. It usually clears itself as Google visits more and the site gains trust. Re-request indexing for these once a month at most.

### 4.3 CTR tweaks for top-10 pages (5 minutes)

1. In **Performance**, filter to your top ~10 pages by position, then sort by **CTR** ascending.
2. Low CTR with a good position means the snippet is not selling the click. Rewrite the page's title tag and meta description:
   - Include the keyword plus a reason to click: a price ("from Rs. 1,999"), a promise ("Cash on Delivery"), or a range ("Under Rs. 5,000").
   - Keep titles under ~60 characters and descriptions under ~155 characters.
3. Change one page per week and give it 1–2 weeks before judging — Google re-tests snippets slowly.
4. Remember: Search Console data lags 24–48 hours, and the first 2–3 weeks have too little data to draw conclusions. Do not over-react to a single week's numbers.

---

## 5. Core Web Vitals check

### 5.1 Run PageSpeed Insights on three pages

Go to https://pagespeed.web.dev and run:

```
https://www.kifayat.co/                          (homepage)
one product page  (a best-seller, from sitemap-products.xml)
https://www.kifayat.co/category/electronics      (a category page)
```

### 5.2 How to read the results

- Score bands: **90+ green**, **50–89 amber**, **below 50 red**.
- Three metrics matter most (targets in parentheses):

| Metric | What it measures | Target |
| --- | --- | --- |
| LCP | How fast the main image or text appears | Under 2.5 s |
| INP | How quickly the page reacts to taps and clicks | Under 200 ms |
| CLS | How much the page jumps while loading | Under 0.10 |

- The **Field data** section (real visitor measurements) matters more than **Lab data**, but a low-traffic store has no field data yet — the lab scores are your baseline.

### 5.3 Common issues on image-heavy storefronts

- **Slow LCP because the hero image is huge.** Compress and resize images: hero under ~200 KB, product images under ~100 KB; serve WebP/AVIF where possible.
- **CLS from images without reserved space.** Give images fixed width/height (or an aspect ratio) so the page does not jump when they load.
- **Below-the-fold images loading too early.** Keep lazy loading on so off-screen images load only when scrolled into view.
- **Heavy JavaScript slowing INP.** A React app ships a large bundle. This is a code task, not a dashboard task — note it for the developers.
- **Vercel is already a strong base.** Hosting speed and TTFB are rarely the problem here; most wins come from image size and image handling.

### 5.4 What to do now

Run the three tests, record the scores, and fix anything red — especially LCP and CLS. Do not chase every amber score in week 1.

---

## 6. Reality check — what to expect and when

| Stage | Timeline | What it looks like |
| --- | --- | --- |
| Indexed | Days | Homepage and category pages appear in Google; check via URL Inspection |
| Long-tail rankings | 1–3 months | Articles and product pages rank for specific terms ("best wireless earbuds under 5000 in Pakistan") — this is where CONTENT-PLAN.md pays off |
| Head-term rankings | 6–18 months | Competitive terms like "wireless earbuds Pakistan" or "online shopping in Pakistan" need authority, reviews, links, and history |

What "appears frequently" realistically means for a new store, in order:

1. **Brand queries** — people searching "kifayat" or "kifayat.co".
2. **Long-tail queries** — from your articles and product titles.
3. **Category terms** — as category pages gain trust.
4. **Head terms** — last, and only after months of consistent work.

If your first weeks show mostly brand searches, that is normal and healthy. The rest of the pyramid builds on it — publish the content plan, keep the weekly 15-minute routine, and re-check this guide's checklists each month.
