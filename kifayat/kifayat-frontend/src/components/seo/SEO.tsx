import { Helmet } from "react-helmet-async";

// ─── Site constants ────────────────────────────────────────────────────────
export const SITE_URL = "https://www.kifayat.co";
export const SITE_NAME = "Kifayat";
export const TWITTER_HANDLE = "@kifayatpk";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;
const DEFAULT_DESCRIPTION =
  "Shop online at Kifayat.co for quality fashion, home goods, and electronics in Pakistan. We deliver all over Pakistan — fast, flat-fee shipping and cash on delivery nationwide.";

// ─── Main SEO component ────────────────────────────────────────────────────
interface SEOProps {
  /** Page title — will be suffixed with " | Kifayat" */
  title?: string;
  description?: string;
  /** Absolute URL of the OG image (1200×630 recommended) */
  image?: string;
  imageType?: string;
  /** Pathname for canonical, e.g. "/products/abc123" */
  path?: string;
  /** Full canonical override (rare) */
  canonical?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  keywords?: string;
  /** Article-specific */
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
  /** Product-specific Open Graph commerce */
  price?: number;
  priceCurrency?: string;
  availability?: "instock" | "oos" | "preorder";
}

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image,
  imageType = "image/jpeg",
  path,
  canonical,
  type = "website",
  noindex = false,
  keywords,
  publishedTime,
  modifiedTime,
  author,
  section,
  tags,
  price,
  priceCurrency = "PKR",
  availability,
}: SEOProps) {
  const fullTitle = title
    ? title === SITE_NAME || title.includes(SITE_NAME)
      ? title
      : `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Quality Products at Honest Prices in Pakistan`;

  const canonicalUrl =
    canonical ?? (path ? `${SITE_URL}${path}` : SITE_URL);

  const ogImage = image || DEFAULT_IMAGE;

  const robots = noindex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  const availabilityMeta =
    availability === "oos"
      ? "out of stock"
      : availability === "preorder"
      ? "preorder"
      : "instock";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={robots} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />

      {/* hreflang — Pakistan English + default */}
      <link rel="alternate" hrefLang="en-PK" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_PK" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:type" content={imageType} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title ?? SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      {author && <meta name="twitter:creator" content={author} />}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={title ?? SITE_NAME} />

      {/* Article-only tags */}
      {type === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === "article" && author && (
        <meta property="article:author" content={author} />
      )}
      {type === "article" && section && (
        <meta property="article:section" content={section} />
      )}
      {type === "article" &&
        tags?.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}

      {/* Product Open Graph commerce extension */}
      {type === "product" && price !== undefined && (
        <>
          <meta property="product:price:amount" content={String(price)} />
          <meta property="product:price:currency" content={priceCurrency} />
          {availability && (
            <meta property="product:availability" content={availabilityMeta} />
          )}
        </>
      )}
    </Helmet>
  );
}
