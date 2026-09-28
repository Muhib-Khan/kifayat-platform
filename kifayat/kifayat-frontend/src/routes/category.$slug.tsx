import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { ProductCard } from "@/components/shop/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { listProducts, listCategories } from "@/lib/shop.functions";
import { useState, useEffect, useMemo } from "react";
import { X, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { SEO, SITE_URL } from "@/components/seo/SEO";
import { BreadcrumbSchema, ItemListSchema, CollectionPageSchema, FAQSchema } from "@/components/seo/JsonLd";
import { ProductGridSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/category/$slug")({
  component: CategoryPage,
});

const SORTS = [
  { value: "", label: "Default" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "trending", label: "Trending" },
];

// ─── Per-category SEO content ───────────────────────────────────────────────
// Hand-written titles/descriptions/intros/FAQs avoid keyword cannibalization:
// every known category gets genuinely unique on-page + structured content.
// Titles omit "| Kifayat" — <SEO> appends it unless already present.
type CategorySeo = {
  title: string;
  description: string;
  intro: string;
  faq: { q: string; a: string }[];
};

const CATEGORY_SEO: Record<string, CategorySeo> = {
  electronics: {
    title: "Electronics in Pakistan — Buy Online with Cash on Delivery",
    description:
      "Shop phones, earbuds, smartwatches and everyday accessories at honest prices, delivered nationwide with cash on delivery — quality electronics at Kifayat.",
    intro:
      "From chargers and earbuds to smartwatches and audio gear, the Electronics collection is edited for gadgets that genuinely earn their place in your day. Prices are honest — no inflated markups, no fake discounts. Orders ship nationwide with cash on delivery, so you only pay when the parcel is in your hands.",
    faq: [
      {
        q: "How long does delivery take for electronics orders?",
        a: "Orders are dispatched within 24 hours and typically arrive in 2–5 working days anywhere in Pakistan, depending on your city.",
      },
      {
        q: "Can I pay cash on delivery for electronics?",
        a: "Yes — cash on delivery is available nationwide on all electronics orders. You only pay when your order arrives at your door.",
      },
      {
        q: "Are the electronics genuine?",
        a: "All electronics at Kifayat are sourced from authorized distributors and importers, inspected before dispatch, and most items include brand warranty.",
      },
      {
        q: "What if my electronic item arrives defective?",
        a: "Report any issue within 7 days of delivery and we'll arrange a replacement or refund — no complicated return processes.",
      },
    ],
  },
  fashion: {
    title: "Fashion in Pakistan — Shop Clothes with Cash on Delivery",
    description:
      "Clothing and seasonal wear for men and women at honest, fair prices, delivered fast nationwide with cash on delivery and easy returns at Kifayat.",
    intro:
      "Seasonal wear, wardrobe staples and statement pieces for every kind of day. The Fashion collection is hand-edited, which means current trends at honest prices — without the hype markup. Every order is delivered nationwide with cash on delivery, and returns are easy if the fit isn't right.",
    faq: [
      {
        q: "How do I find the right size?",
        a: "Check the size guidance on each product page, and if the fit isn't right, exchanges are easy within 7 days of delivery.",
      },
      {
        q: "What is the price range for fashion items?",
        a: "Most fashion items at Kifayat range from around Rs 1,000 to Rs 8,000, with new seasonal pieces added regularly.",
      },
      {
        q: "Can I pay cash on delivery for fashion orders?",
        a: "Yes — cash on delivery is available nationwide, so you only pay when your order is delivered.",
      },
      {
        q: "Do you accept returns on clothing?",
        a: "Yes — unworn items with tags can be returned or exchanged within 7 days of delivery.",
      },
    ],
  },
  "home-kitchen": {
    title: "Home & Kitchen Appliances in Pakistan — Cash on Delivery",
    description:
      "Appliances, cookware and home essentials for modern kitchens at honest prices. Order online with nationwide delivery and cash on delivery at Kifayat.",
    intro:
      "Cookware, small appliances and the little things that make a kitchen feel finished — the Home & Kitchen collection is built around better daily routines. We stock honest-priced essentials that hold up to real cooking, and ship them nationwide with cash on delivery.",
    faq: [
      {
        q: "Are kitchen appliances covered by warranty?",
        a: "Yes — all major appliances come with brand or store warranty; coverage details are listed on each product page.",
      },
      {
        q: "How long does delivery take for home & kitchen orders?",
        a: "We dispatch within 24 hours and deliver in 2–5 working days nationwide, with cash on delivery available on every order.",
      },
      {
        q: "What price range can I expect?",
        a: "From everyday essentials under Rs 1,000 to larger appliances, with most items between Rs 1,500 and Rs 15,000.",
      },
      {
        q: "What if an appliance arrives damaged?",
        a: "Contact us within 7 days of delivery and we'll replace it or refund you — no hassle.",
      },
    ],
  },
  beauty: {
    title: "Beauty in Pakistan — Skincare & Makeup, Cash on Delivery",
    description:
      "Skincare, makeup and hair care from trusted brands at honest prices. Cash on delivery with fast, nationwide delivery and easy returns at Kifayat.",
    intro:
      "Skincare, makeup and hair care that are kind to your skin and your wallet. The Beauty collection is curated from trusted brands at honest prices — no inflated retail games. Order with cash on delivery and we'll bring it to your door anywhere in Pakistan.",
    faq: [
      {
        q: "Are your beauty products authentic?",
        a: "Yes — every product is sourced from authorized distributors and arrives sealed in its original packaging.",
      },
      {
        q: "Can I pay cash on delivery for beauty products?",
        a: "Yes — cash on delivery is available nationwide, so you only pay when your order arrives.",
      },
      {
        q: "What is the price range for beauty products?",
        a: "Most beauty products at Kifayat range from Rs 500 to Rs 5,000, covering everyday essentials and premium lines.",
      },
      {
        q: "Do you accept returns on beauty products?",
        a: "Unopened, sealed items can be returned within 7 days of delivery for a full refund.",
      },
    ],
  },
  sports: {
    title: "Buy Sports Gear Online in Pakistan — Cash on Delivery",
    description:
      "Fitness equipment, activewear and training gear at honest prices for every athlete. Nationwide delivery with cash on delivery across Pakistan at Kifayat.",
    intro:
      "Gear for the gym, the field and everything in between — from activewear to training equipment. Prices are honest across the board, and every order ships nationwide with cash on delivery, so your fitness setup arrives ready to use.",
    faq: [
      {
        q: "What sports and fitness categories do you cover?",
        a: "Gym and training gear, activewear, and equipment for cricket, football and other sports — with new arrivals added regularly.",
      },
      {
        q: "Can I pay cash on delivery for sports gear?",
        a: "Yes — cash on delivery is available nationwide on all sports and fitness orders.",
      },
      {
        q: "Is the gear genuine branded equipment?",
        a: "We stock original branded and vetted third-party gear; any unbranded items are clearly marked on the product page.",
      },
      {
        q: "How long does delivery take?",
        a: "Orders are dispatched within 24 hours and reach most cities in 2–5 working days.",
      },
    ],
  },
  toys: {
    title: "Toys & Games for Kids in Pakistan — Cash on Delivery",
    description:
      "Educational toys, games and gifts for kids at honest prices. Safe, quality toys, delivered fast nationwide with cash on delivery across Pakistan at Kifayat.",
    intro:
      "Toys and games that keep curious minds busy — from educational sets to everyday favourites. Every item is safety-checked, honestly priced and delivered nationwide with cash on delivery.",
    faq: [
      {
        q: "Are the toys safe for children?",
        a: "Yes — all toys meet international safety standards, and age recommendations are listed on each product page.",
      },
      {
        q: "Can I pay cash on delivery for toys?",
        a: "Yes — cash on delivery is available nationwide, so you only pay when your order arrives.",
      },
      {
        q: "What if a toy arrives damaged?",
        a: "Report it within 7 days of delivery and we'll replace it or refund you.",
      },
    ],
  },
};

const FALLBACK_FAQ: { q: string; a: string }[] = [
  {
    q: "How long does delivery take?",
    a: "Orders are dispatched within 24 hours and usually arrive in 2–5 working days anywhere in Pakistan.",
  },
  {
    q: "Is cash on delivery available?",
    a: "Yes — cash on delivery is available nationwide on all orders, so you only pay when your order arrives.",
  },
  {
    q: "What is your return policy?",
    a: "Report any issue within 7 days of delivery and we'll arrange a replacement or refund.",
  },
];

function PriceSlider({
  min, max, value, onChange,
}: {
  min: number; max: number; value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  if (max <= min) return null;
  return (
    <SliderPrimitive.Root
      min={min} max={max} step={100}
      value={value}
      onValueChange={(v) => onChange(v as [number, number])}
      className="relative flex items-center w-full select-none touch-none h-5"
    >
      <SliderPrimitive.Track className="relative h-px w-full bg-coal/20 grow">
        <SliderPrimitive.Range className="absolute h-full bg-brass" />
      </SliderPrimitive.Track>
      {[0, 1].map((i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-3.5 bg-brass border-2 border-brass shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 cursor-grab active:cursor-grabbing transition-transform hover:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

function CategoryPage() {
  const { slug } = Route.useParams();

  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [priceReady, setPriceReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const PAGE_SIZE = 24;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });

  const categoryName = useMemo(() => {
    const match = categories.find((c) => c.slug === slug);
    return match?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [categories, slug]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", "category", slug, sort, page],
    queryFn: () => listProducts({ categorySlug: slug, sort, limit: PAGE_SIZE, page }),
    staleTime: 5 * 60 * 1000,
  });

  const allProducts = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  const [globalMin, globalMax] = useMemo(() => {
    if (!allProducts.length) return [0, 0];
    const prices = allProducts.map((p) => p.price);
    return [Math.min(...prices), Math.max(...prices)];
  }, [allProducts]);

  useEffect(() => {
    if (globalMax > 0 && !priceReady) {
      setPriceRange([globalMin, globalMax]);
      setPriceReady(true);
    }
  }, [globalMin, globalMax, priceReady]);

  useEffect(() => {
    setPriceReady(false);
    setPriceRange([0, 0]);
    setSort("");
    setPage(1);
  }, [slug]);

  const products = useMemo(() => {
    if (!priceReady) return allProducts;
    return allProducts.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);
  }, [allProducts, priceRange, priceReady]);

  const hasFilters = sort || (priceReady && (priceRange[0] > globalMin || priceRange[1] < globalMax));

  function clearAll() {
    setSort("");
    setPage(1);
    if (priceReady) setPriceRange([globalMin, globalMax]);
  }

  function setSortAndReset(s: string) {
    setSort(s);
    setPage(1);
  }

  const itemListItems = products.map((p: any) => ({
    name: p.name,
    url: `${SITE_URL}/products/${p.slug || p.id}`,
  }));
  const seo = CATEGORY_SEO[slug];

  // Fall back to the existing template behavior for unknown slugs — never crash.
  const categoryTitle = seo?.title ?? `${categoryName} — Shop Online in Pakistan`;
  const categoryDesc =
    seo?.description ??
    `Shop ${categoryName} online in Pakistan at Kifayat. Quality ${categoryName.toLowerCase()} products with fast delivery all across Pakistan and flat delivery — the cheapest delivery in Pakistan.`;
  const categoryIntro =
    seo?.intro ??
    `Browse the ${categoryName} collection at Kifayat — quality products at honest prices. Every order is delivered nationwide with cash on delivery, so you only pay when it arrives.`;
  const categoryFaq = seo?.faq ?? FALLBACK_FAQ;

  return (
    <PageShell>
      <SEO
        title={categoryTitle}
        description={categoryDesc}
        path={`/category/${slug}`}
        keywords={`${categoryName} online Pakistan, buy ${categoryName.toLowerCase()} Pakistan, ${categoryName.toLowerCase()} shop Pakistan`}
      />
      <CollectionPageSchema
        name={`${categoryName} — Kifayat`}
        description={categoryDesc}
        url={`${SITE_URL}/category/${slug}`}
        itemCount={products.length}
      />
      <BreadcrumbSchema
        crumbs={[
          { name: "Home", url: SITE_URL },
          { name: "Products", url: `${SITE_URL}/products` },
          { name: categoryName, url: `${SITE_URL}/category/${slug}` },
        ]}
      />
      <FAQSchema faqs={categoryFaq} />
      {products.length > 0 && (
        <ItemListSchema
          items={products.slice(0, 20).map((p: any) => ({
            name: p.name,
            url: `${SITE_URL}/products/${p.slug || p.id}`,
            image: p.image_url || undefined,
            price: p.price,
          }))}
          url={`${SITE_URL}/category/${slug}`}
        />
      )}
      <PageHeader
        title={categoryName}
        subtitle={`Curated objects · ${categoryName}.`}
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Products", to: "/products" },
          { label: categoryName },
        ]}
      />

      {/* Unique per-category intro — thin, duplicated content hurts SEO */}
      {categoryIntro && (
        <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-6">
          <p className="text-sm leading-relaxed text-coal/60">{categoryIntro}</p>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 lg:py-10">
        <div className="flex gap-8 items-start">

          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-52 shrink-0 sticky top-[200px] space-y-8">
            <div>
              <p className="eyebrow text-coal/40 text-xs mb-3">Sort by</p>
              <ul className="space-y-1">
                {SORTS.map((s) => (
                  <li key={s.value}>
                    <button
                      onClick={() => setSortAndReset(s.value)}
                      className={`w-full text-left text-sm py-1.5 transition flex items-center justify-between ${
                        sort === s.value ? "text-brass font-medium" : "text-coal/60 hover:text-coal"
                      }`}
                    >
                      {s.label}
                      {sort === s.value && <span className="size-1.5 rounded-full bg-brass" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {priceReady && globalMax > globalMin && (
              <div>
                <p className="eyebrow text-coal/40 text-xs mb-4">Price range</p>
                <PriceSlider min={globalMin} max={globalMax} value={priceRange} onChange={setPriceRange} />
                <div className="flex justify-between mt-3 text-xs text-coal/60 font-mono tabular-nums">
                  <span>Rs {priceRange[0].toLocaleString()}</span>
                  <span>Rs {priceRange[1].toLocaleString()}</span>
                </div>
              </div>
            )}

            {categories.length > 0 && (
              <div>
                <p className="eyebrow text-coal/40 text-xs mb-3">Other categories</p>
                <ul className="space-y-0.5">
                  {categories.filter((c) => c.slug !== slug).map((c) => (
                    <li key={c.slug}>
                      <Link
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        className="flex items-center justify-between group py-1.5 text-sm text-coal/60 hover:text-coal transition"
                      >
                        <span>{c.name}</span>
                        <span className="size-1 rounded-full bg-coal/15 group-hover:bg-brass transition" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasFilters && (
              <button onClick={clearAll} className="eyebrow text-xs text-coal/40 hover:text-brass transition flex items-center gap-1.5">
                <X className="size-3" strokeWidth={2} /> Clear filters
              </button>
            )}
          </aside>

          {/* Main column */}
          <div className="flex-1 min-w-0">
            {/* Mobile controls */}
            <div className="flex items-center gap-3 mb-5 lg:hidden">
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex items-center gap-2 eyebrow text-xs border border-coal/20 px-3 py-2 min-h-9 hover:border-coal transition"
              >
                <SlidersHorizontal className="size-3.5" strokeWidth={1.5} />
                Filters
              </button>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-1 scrollbar-none">
                {SORTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSortAndReset(s.value)}
                    className={`shrink-0 eyebrow text-xs px-3 py-2 min-h-9 border transition ${
                      sort === s.value ? "border-coal bg-coal text-bone" : "border-coal/15 text-coal/60 hover:border-coal"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile filter panel */}
            {filtersOpen && (
              <div className="lg:hidden border border-coal/10 bg-bone/40 p-5 mb-5 space-y-6">
                {priceReady && globalMax > globalMin && (
                  <div>
                    <p className="eyebrow text-coal/40 text-xs mb-4">Price range</p>
                    <PriceSlider min={globalMin} max={globalMax} value={priceRange} onChange={setPriceRange} />
                    <div className="flex justify-between mt-3 text-xs text-coal/60 font-mono tabular-nums">
                      <span>Rs {priceRange[0].toLocaleString()}</span>
                      <span>Rs {priceRange[1].toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {categories.length > 0 && (
                  <div>
                    <p className="eyebrow text-coal/40 text-xs mb-3">Other categories</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.filter((c) => c.slug !== slug).map((c) => (
                        <Link
                          key={c.slug}
                          to="/category/$slug"
                          params={{ slug: c.slug }}
                          onClick={() => setFiltersOpen(false)}
                          className="eyebrow text-xs border border-coal/15 px-3 py-1.5 hover:border-brass hover:text-brass transition"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {hasFilters && (
                  <button onClick={clearAll} className="eyebrow text-xs text-coal/40 hover:text-brass transition flex items-center gap-1.5">
                    <X className="size-3" strokeWidth={2} /> Clear all
                  </button>
                )}
              </div>
            )}

            {/* Count row */}
            <div className="flex items-center justify-between mb-6">
              {isLoading ? (
                <span className="eyebrow text-coal/40 text-xs">Loading…</span>
              ) : (
                <span className="eyebrow text-coal/40 text-xs">
                  {total} {total === 1 ? "object" : "objects"}
                </span>
              )}
              {hasFilters && (
                <button onClick={clearAll} className="hidden lg:flex items-center gap-1.5 eyebrow text-xs text-coal/40 hover:text-brass transition">
                  <X className="size-3" strokeWidth={2} /> Clear filters
                </button>
              )}
            </div>

            {/* Grid */}
            {products.length === 0 && !isLoading ? (
              isError ? (
                <div className="text-center py-24 border border-dashed border-coal/10">
                  <p className="font-display italic text-3xl text-coal/30 mb-4">The store is waking up<span className="text-brass">.</span></p>
                  <p className="text-sm text-coal/55 mb-6">We couldn't load this category — try again in a moment.</p>
                  <button
                    onClick={() => refetch()}
                    className="eyebrow text-xs border border-coal/20 px-5 py-2.5 hover:bg-coal hover:text-bone transition"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="text-center py-24 border border-dashed border-coal/10">
                  <p className="font-display italic text-3xl text-coal/30 mb-4">Nothing found.</p>
                  <button onClick={clearAll} className="eyebrow text-xs text-coal/50 hover:text-coal underline transition">
                    Clear all filters
                  </button>
                </div>
              )
            ) : isLoading ? (
              <ProductGridSkeleton count={8} columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                {products.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    index={i}
                    p={{
                      id: p.id,
                      slug: p.slug,
                      name: p.name,
                      brand: p.brand,
                      price: p.price,
                      oldPrice: p.old_price,
                      image: p.image_url || "",
                      badge: p.badge,
                      inStock: p.inStock,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={page <= 1}
                  className="px-4 py-2 min-h-9 text-sm font-medium border border-coal/20 hover:bg-coal hover:text-bone disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <ChevronLeft className="size-4" strokeWidth={1.5} /> Prev
                </button>
                <span className="text-sm text-coal/60 px-3 font-mono tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={page >= totalPages}
                  className="px-4 py-2 min-h-9 text-sm font-medium border border-coal/20 hover:bg-coal hover:text-bone disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  Next <ChevronRight className="size-4" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
