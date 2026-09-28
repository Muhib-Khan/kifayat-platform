import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";
import { Search as SearchIcon, Star, ArrowUpRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/lib/search.functions";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo/SEO";
import { SearchResultsPageSchema } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/components/seo/SEO";
import { useT } from "@/lib/i18n";
import { optImage } from "@/lib/product-image-map";

const SORT_LABELS: Record<string, string> = {
  relevance: "Relevance",
  newest: "Newest",
  price_asc: "Price: Low → High",
  price_desc: "Price: High → Low",
  rating: "Highest rated",
};

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: (s.q as string) ?? "",
    sort: (s.sort as string) ?? "relevance",
    brand: (s.brand as string) ?? "",
    min_price: s.min_price ? Number(s.min_price) : undefined,
    max_price: s.max_price ? Number(s.max_price) : undefined,
    page: s.page ? Number(s.page) : 1,
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState(search.q);
  const t = useT();

  useEffect(() => setQuery(search.q), [search.q]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", search],
    queryFn: () =>
      searchProducts({
        q: search.q,
        sort: search.sort as any,
        brand: search.brand || null,
        min_price: search.min_price ?? null,
        max_price: search.max_price ?? null,
        page: search.page,
      }),
    enabled: !!search.q,
  });

  const updateSearch = (next: Partial<typeof search>) => {
    navigate({ to: "/search", search: (prev: any): any => ({ ...prev, ...next, page: next.page ?? 1 }) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch({ q: query.trim(), page: 1 });
  };

  const results = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  const seoTitle = search.q
    ? `"${search.q}" — Search Results`
    : "Search Products";
  const seoDesc = search.q
    ? `Browse ${results.length > 0 ? results.length + "+" : ""} results for "${search.q}" at Kifayat. Shop quality products in Pakistan with fast delivery all across Pakistan.`
    : "Search thousands of quality products at Kifayat — electronics, fashion, home goods and more with delivery across Pakistan.";

  return (
    <PageShell>
      <SEO
        title={seoTitle}
        description={seoDesc}
        path="/search"
      />
      {search.q && (
        <SearchResultsPageSchema
          query={search.q}
          url={`${SITE_URL}/search?q=${encodeURIComponent(search.q)}`}
        />
      )}

      <section className="bg-coal text-bone">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-10 lg:pt-16 pb-10 lg:pb-14">
          <p className="eyebrow text-bone/60 mb-6 flex items-center gap-3">
            <span className="h-px w-8 bg-bone/40" /> The Index · Search
          </p>
          <h1 className="font-display italic text-5xl sm:text-6xl lg:text-8xl leading-[0.88] mb-8">
            {search.q ? (
              <>
                "<span className="text-brass">{search.q}</span>"
              </>
            ) : (
              <>
                Find the object<span className="text-brass">.</span>
              </>
            )}
          </h1>
          <form onSubmit={submit} className="relative max-w-2xl">
            <SearchIcon
              className="size-5 absolute left-5 top-1/2 -translate-y-1/2 text-bone/50"
              strokeWidth={1.4}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands, categories…"
              className="w-full h-14 pl-14 pr-32 bg-bone/5 border border-bone/20 outline-none focus:border-brass text-bone placeholder:text-bone/40 text-base transition"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-brass text-coal eyebrow px-4 py-2 text-xs hover:bg-brass/90 transition"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="max-w-[1600px] mx-auto px-5 lg:px-10 py-8 lg:py-12">
        {/* Filters row */}
        {search.q && (
          <div className="flex items-center gap-3 flex-wrap mb-8">
            <span className="text-sm text-muted-foreground">
              {isFetching ? "Searching…" : `${data?.total ?? 0} results`}
            </span>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {Object.entries(SORT_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => updateSearch({ sort: val })}
                  className={`px-3 py-1.5 min-h-9 text-xs font-medium rounded-md border transition whitespace-nowrap ${
                    search.sort === val
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              {(search.brand || search.min_price || search.max_price) && (
                <button
                  onClick={() => updateSearch({ brand: "", min_price: undefined, max_price: undefined })}
                  className="flex items-center gap-1 px-3 py-1.5 min-h-9 text-xs font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10 transition whitespace-nowrap"
                >
                  <X className="size-3" /> Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {!search.q ? (
          <div className="text-center py-24 text-muted-foreground">
            <SearchIcon className="size-12 mx-auto mb-4 opacity-20" strokeWidth={1} />
            <p className="text-lg font-medium">Type something to search</p>
          </div>
        ) : isFetching && !data ? (
          <ProductGridSkeleton count={12} columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4" />
        ) : results.length === 0 && !isFetching ? (
          <div className="text-center py-24">
            <p className="text-lg font-semibold mb-2">No results for "{search.q}"</p>
            <p className="text-sm text-muted-foreground mb-6">Try a different search term or browse by category.</p>
            <Link to="/products" className="text-sm font-medium underline underline-offset-4">Browse all products →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {results.map((p: any) => (
              <Link
                key={p.id}
                to="/products/$productId"
                params={{ productId: p.slug || p.id }}
                className="group bg-card border border-border hover:border-foreground/20 rounded-xl overflow-hidden transition"
              >
                <div className="relative aspect-square bg-secondary overflow-hidden">
                  {p.image_url ? (
                    <img
                      src={optImage(p.image_url, 600)}
                      alt={p.name}
                      className={`size-full object-contain p-3 [@media(hover:hover)]:group-hover:scale-105 transition duration-500 ${p.inStock === false ? "grayscale opacity-70" : ""}`}
                      loading="lazy"
                      width={600}
                      height={600}
                    />
                  ) : (
                    <div className="size-full grid place-items-center text-muted-foreground/20 text-4xl font-display">
                      {p.name[0]}
                    </div>
                  )}
                  {p.inStock === false && (
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="eyebrow bg-coal text-bone px-3 py-1.5">{t("btn.outOfStock")}</span>
                    </div>
                  )}
                </div>
                <div className="p-2 sm:p-3 space-y-1">
                  <p className="text-xs text-muted-foreground line-clamp-1">{p.brand || p.category_name}</p>
                  <p className="text-sm font-semibold line-clamp-2 leading-snug">{p.name}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-brass">Rs {p.price.toLocaleString()}</span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition" />
                  </div>
                  {p.rating && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-brass text-brass" strokeWidth={0} />
                      {p.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => updateSearch({ page: search.page - 1 })}
              disabled={search.page <= 1}
              className="px-4 py-2 min-h-9 text-sm font-medium border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-muted-foreground px-3">
              Page {search.page} of {totalPages}
            </span>
            <button
              onClick={() => updateSearch({ page: search.page + 1 })}
              disabled={search.page >= totalPages}
              className="px-4 py-2 min-h-9 text-sm font-medium border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </PageShell>
  );
}
