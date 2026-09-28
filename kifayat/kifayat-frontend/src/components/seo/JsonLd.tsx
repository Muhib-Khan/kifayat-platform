import { Helmet } from "react-helmet-async";
import { SITE_URL, SITE_NAME } from "./SEO";

// ─── Base helper ───────────────────────────────────────────────────────────
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data, null, 0)}
      </script>
    </Helmet>
  );
}

// ─── WebSite + Sitelinks SearchBox ────────────────────────────────────────
export function WebSiteSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "Pakistan's trusted online store for quality electronics, fashion, home goods and more. Flat delivery — Cheapest Delivery in Pakistan.",
        inLanguage: "en-PK",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

// ─── OnlineStore (Google Knowledge Panel entity) ──────────────────────────
export function OnlineStoreSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        "@id": `${SITE_URL}/#onlinestore`,
        name: "Kifayat",
        alternateName: "Kifayat Online Shopping",
        url: SITE_URL,
        logo: `${SITE_URL}/logo.webp`,
        image: `${SITE_URL}/og-default.jpg`,
        inLanguage: "en-PK",
        areaServed: "PK",
      }}
    />
  );
}

// ─── Organization ─────────────────────────────────────────────────────────
export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "Pakistan's trusted online store delivering quality electronics, fashion, home goods, beauty and more all across Pakistan.",
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_URL}/#logo`,
          url: `${SITE_URL}/logo.webp`,
          contentUrl: `${SITE_URL}/logo.webp`,
          width: 400,
          height: 80,
          caption: SITE_NAME,
        },
        image: `${SITE_URL}/og-default.jpg`,
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: "contact@kifayat.co",
            availableLanguage: ["English"],
            areaServed: "PK",
          },
        ],
        sameAs: [
          "https://www.facebook.com/kifayatpk",
          "https://www.instagram.com/kifayatpk",
          "https://twitter.com/kifayatpk",
          "https://www.tiktok.com/@kifayatpk",
        ],
        foundingDate: "2024",
        areaServed: {
          "@type": "Country",
          name: "Pakistan",
        },
        knowsAbout: [
          "Online Shopping",
          "E-commerce Pakistan",
          "Electronics",
          "Fashion",
          "Home Goods",
          "Beauty Products",
          "Cash on Delivery",
        ],
      }}
    />
  );
}

// ─── Combined @graph for Homepage (WebSite + Organization in one block) ───
export function HomepageGraphSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: SITE_NAME,
            url: SITE_URL,
            description:
              "Pakistan's trusted online store for quality electronics, fashion, home goods and more. Flat delivery — Cheapest Delivery in Pakistan.",
            inLanguage: "en-PK",
            publisher: { "@id": `${SITE_URL}/#organization` },
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
              "@type": "ImageObject",
              "@id": `${SITE_URL}/#logo`,
              url: `${SITE_URL}/logo.webp`,
              width: 400,
              height: 80,
            },
            image: `${SITE_URL}/og-default.jpg`,
            contactPoint: [
              {
                "@type": "ContactPoint",
                contactType: "customer service",
                email: "contact@kifayat.co",
                availableLanguage: ["English"],
                areaServed: "PK",
              },
            ],
            sameAs: [
              "https://www.facebook.com/kifayatpk",
              "https://www.instagram.com/kifayatpk",
              "https://twitter.com/kifayatpk",
              "https://www.tiktok.com/@kifayatpk",
            ],
          },
          {
            "@type": "WebPage",
            "@id": `${SITE_URL}/#webpage`,
            url: SITE_URL,
            name: `${SITE_NAME} — Quality Products at Honest Prices in Pakistan`,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            about: { "@id": `${SITE_URL}/#organization` },
            inLanguage: "en-PK",
          },
        ],
      }}
    />
  );
}

// ─── Product ──────────────────────────────────────────────────────────────
export function ProductSchema({
  product,
  url,
}: {
  product: {
    id: string;
    name: string;
    description?: string;
    brand?: string;
    sku?: string;
    mpn?: string;
    price: number;
    old_price?: number;
    image_url?: string;
    images?: string[];
    inStock?: boolean;
    reviewCount?: number;
    rating?: number;
    reviews?: { author: string; rating: number; body: string; date: string }[];
    keywords?: string;
  };
  url: string;
}) {
  const priceValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const allImages = product.images?.length
    ? product.images
    : product.image_url
    ? [product.image_url]
    : [];

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    name: product.name,
    description: product.description || product.name,
    url,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    sku: product.sku || product.id,
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(product.keywords ? { keywords: product.keywords } : {}),
    offers: {
      "@type": "Offer",
      "@id": `${url}#offer`,
      url,
      priceCurrency: "PKR",
      price: product.price,
      priceValidUntil,
      availability:
        product.inStock !== false
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
      },
      // Google Shopping: shipping details — CRITICAL for rich results
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: 100,
          currency: "PKR",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "PK",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          businessDays: {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ],
          },
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 1,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 2,
            maxValue: 5,
            unitCode: "DAY",
          },
        },
      },
      // Google Shopping: return policy — CRITICAL for rich results
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "PK",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
      ...(product.old_price
        ? {
            priceSpecification: {
              "@type": "PriceSpecification",
              price: product.price,
              priceCurrency: "PKR",
            },
          }
        : {}),
    },
  };

  if (allImages.length > 0) {
    schema.image = allImages;
  }

  // AggregateRating — only real data
  if (product.reviewCount && product.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating ?? 4.2,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Individual reviews
  if (product.reviews && product.reviews.length > 0) {
    schema.review = product.reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.author },
      reviewBody: r.body,
      datePublished: r.date,
    }));
  }

  return <JsonLd data={schema} />;
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────
export function BreadcrumbSchema({
  crumbs,
}: {
  crumbs: { name: string; url: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      }}
    />
  );
}

// ─── CollectionPage (category pages) ──────────────────────────────────────
export function CollectionPageSchema({
  name,
  description,
  url,
  image,
  itemCount,
}: {
  name: string;
  description: string;
  url: string;
  image?: string;
  itemCount?: number;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        name,
        description,
        url,
        inLanguage: "en-PK",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        ...(image ? { image } : {}),
        ...(itemCount !== undefined
          ? { numberOfItems: itemCount }
          : {}),
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Products", item: `${SITE_URL}/products` },
            { "@type": "ListItem", position: 3, name, item: url },
          ],
        },
        publisher: { "@id": `${SITE_URL}/#organization` },
      }}
    />
  );
}

// ─── ItemList (category / search listing) ─────────────────────────────────
export function ItemListSchema({
  items,
  url,
}: {
  items: { name: string; url: string; image?: string; price?: number }[];
  url: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        url,
        numberOfItems: items.length,
        itemListElement: items.slice(0, 20).map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: item.url,
          name: item.name,
          ...(item.image || item.price !== undefined
            ? {
                item: {
                  "@type": "Product",
                  name: item.name,
                  url: item.url,
                  ...(item.image ? { image: item.image } : {}),
                  ...(item.price !== undefined
                    ? {
                        offers: {
                          "@type": "Offer",
                          price: item.price,
                          priceCurrency: "PKR",
                          availability: "https://schema.org/InStock",
                        },
                      }
                    : {}),
                },
              }
            : {}),
        })),
      }}
    />
  );
}

// ─── SearchResultsPage ────────────────────────────────────────────────────
export function SearchResultsPageSchema({ query, url }: { query: string; url: string }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        "@id": `${url}#webpage`,
        name: `Search results for "${query}" — ${SITE_NAME}`,
        url,
        inLanguage: "en-PK",
        isPartOf: { "@id": `${SITE_URL}/#website` },
      }}
    />
  );
}

// ─── Article (blog) ───────────────────────────────────────────────────────
export function ArticleSchema({
  post,
  url,
}: {
  post: {
    title: string;
    excerpt: string;
    cover: string;
    author: string;
    date: string;
    readMins?: number;
    tags?: string[];
  };
  url: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.excerpt,
        image: {
          "@type": "ImageObject",
          url: post.cover,
          width: 1200,
          height: 630,
        },
        url,
        inLanguage: "en-PK",
        author: {
          "@type": "Person",
          name: post.author,
        },
        publisher: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/logo.webp`,
          },
        },
        datePublished: post.date,
        dateModified: post.date,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": url,
        },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        ...(post.readMins
          ? { timeRequired: `PT${post.readMins}M` }
          : {}),
        ...(post.tags?.length
          ? { keywords: post.tags.join(", ") }
          : {}),
      }}
    />
  );
}

// ─── FAQPage ──────────────────────────────────────────────────────────────
export function FAQSchema({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: {
            "@type": "Answer",
            text: a,
          },
        })),
      }}
    />
  );
}

// ─── BlogPosting (ready for future blog routes) ────────────────────────────
export function BlogPostingSchema({
  title,
  url,
  description,
  datePublished,
  image,
  authorName,
}: {
  title: string;
  url: string;
  description: string;
  datePublished: string;
  image?: string;
  authorName?: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#blogposting`,
        headline: title,
        name: title,
        description,
        url,
        inLanguage: "en-PK",
        ...(image
          ? {
              image: {
                "@type": "ImageObject",
                url: image,
                width: 1200,
                height: 630,
              },
            }
          : {}),
        ...(authorName
          ? { author: { "@type": "Person", name: authorName } }
          : {}),
        publisher: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/logo.webp`,
          },
        },
        datePublished,
        dateModified: datePublished,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": url,
        },
        articleSection: "Guides & Stories",
        isPartOf: { "@id": `${SITE_URL}/#website` },
      }}
    />
  );
}

// ─── LocalBusiness / OnlineStore (Contact page) ───────────────────────────
export function LocalBusinessSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        "@id": `${SITE_URL}/#localbusiness`,
        name: SITE_NAME,
        url: SITE_URL,
        image: `${SITE_URL}/og-default.jpg`,
        description:
          "Pakistan's trusted online store for quality products. Flat delivery — Cheapest Delivery in Pakistan.",
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
            opens: "09:00",
            closes: "21:00",
          },
        ],
        currenciesAccepted: "PKR",
        paymentAccepted: "Cash, Credit Card, Easypaisa, JazzCash, Bank Transfer",
        priceRange: "Rs 500 - Rs 50,000",
        areaServed: [
          { "@type": "Country", name: "Pakistan" },
        ],
        email: "contact@kifayat.co",
        sameAs: [
          "https://www.facebook.com/kifayatpk",
          "https://www.instagram.com/kifayatpk",
          "https://twitter.com/kifayatpk",
        ],
      }}
    />
  );
}

// ─── WebPage (generic — use for About, Contact, etc.) ─────────────────────
export function WebPageSchema({
  name,
  description,
  url,
  type = "WebPage",
}: {
  name: string;
  description: string;
  url: string;
  type?: "WebPage" | "AboutPage" | "ContactPage" | "FAQPage";
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": type,
        "@id": `${url}#webpage`,
        name,
        description,
        url,
        inLanguage: "en-PK",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      }}
    />
  );
}
