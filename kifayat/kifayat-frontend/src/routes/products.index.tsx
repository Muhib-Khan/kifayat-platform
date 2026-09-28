import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { ProductCard } from "@/components/shop/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { listProducts, listCategories } from "@/lib/shop.functions";
import { useState } from "react";
import { X, SlidersHorizontal, ChevronRight, ChevronLeft } from "lucide-react";
import { SEO } from "@/components/seo/SEO";
import { BreadcrumbSchema, ItemListSchema } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/components/seo/SEO";
import { ProductGridSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
});

const PAGE_SIZE = 24;

const SORTS = [
  { value: "", label: "Default" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "trending", label: "Trending" },
];

/* ── Main page ──────────────────────────────────────────────────────────────── */
function ProductsPage() {
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", sort, page],
    queryFn: () => listProducts({ sort, limit: PAGE_SIZE, page }),
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });

  function clearAll() {
    setSort("");
    setPage(1);
  }

  function setSortAndReset(s: string) {
    setSort(s);
    setPage(1);
  }

  const itemListItems = products.map((p: any) => ({
    name: p.name,
    url: `${SITE_URL}/products/${p.slug || p.id}`,
  }));

  return (
    <PageShell>
      <SEO
        title="All Products — Electronics, Fashion, Home Goods & More"
        description="Browse Kifayat's full catalogue of quality products. Electronics, fashion, home goods, beauty, sports and more — with flat delivery across Pakistan, the cheapest delivery in Pakistan."
        path="/products"
        keywords="online shopping Pakistan, electronics Pakistan, fashion Pakistan, home goods online, buy online Pakistan"
      />
      <BreadcrumbSchema
        crumbs={[
          { name: "Home", url: SITE_URL },
          { name: "Products", url: `${SITE_URL}/products` },
        ]}
      />
      {products.length > 0 && <ItemListSchema items={itemListItems} url={`${SITE_URL}/products`} />}
      <PageHeader
        title="The catalogue"
        subtitle="Every object, considered."
        breadcrumbs={[{ label: "Home", to: "/" }, { label: "Products" }]}
      />

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

            {categories.length > 0 && (
              <div>
                <p className="eyebrow text-coal/40 text-xs mb-3">Categories</p>
                <ul className="space-y-0.5">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        className="flex items-center justify-between group py-1.5 text-sm text-coal/60 hover:text-coal transition"
                      >
                        <span>{c.name}</span>
                        <ChevronRight className="size-3 text-coal/20 group-hover:text-brass group-hover:translate-x-0.5 transition" strokeWidth={1.5} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sort && (
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
                {categories.length > 0 && (
                  <div>
                    <p className="eyebrow text-coal/40 text-xs mb-3">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => (
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
                {sort && (
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
              {sort && (
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
                  <p className="text-sm text-coal/55 mb-6">We couldn't load the catalogue — try again in a moment.</p>
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
              <ProductGridSkeleton count={9} columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6" />
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
