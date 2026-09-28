import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, ArrowUpRight } from "lucide-react";
import { PageHeader, PageShell } from "@/components/landing/PageShell";
import { ProductCard } from "@/components/shop/ProductCard";
import { getSellerStore } from "@/lib/seller.functions";
import { SEO } from "@/components/seo/SEO";

export const Route = createFileRoute("/seller/$slug")({
  component: SellerStorefront,
});

function SellerStorefront() {
  const { slug } = Route.useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["seller-store", slug],
    queryFn: () => getSellerStore(slug),
    staleTime: 30_000,
  });
  const storeName = data?.seller?.storeName || "Seller store";

  return (
    <PageShell>
      <SEO
        title={`${storeName} | Kifayat`}
        description={`Shop products from ${storeName} on Kifayat.`}
      />
      <PageHeader
        title={storeName}
        subtitle="A curated shelf from one of Kifayat's sellers."
        breadcrumbs={[{ label: "Home", to: "/" }, { label: storeName }]}
      />
      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="size-10 rounded-full bg-brass/20 text-brass grid place-items-center">
            <Store className="size-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="eyebrow text-[10px] text-coal/50">Seller collection</p>
            <p className="text-sm text-coal/70">Available products from {storeName}</p>
          </div>
          <Link to="/products" className="ml-auto inline-flex items-center gap-1.5 text-xs eyebrow text-coal/60 hover:text-brass transition-colors">
            Browse all <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-10" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <div className="aspect-square rounded-xl bg-paper animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-coal/10 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-coal/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="font-display italic text-xl">This store could not be loaded.</p>
            <p className="mt-2 text-sm text-coal/60">Please try again in a moment.</p>
          </div>
        ) : data?.products?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-10">
            {data.products.map((product, index) => (
              <ProductCard
                key={product.id}
                index={index}
                p={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  brand: storeName,
                  price: product.price,
                  image: product.image_url || "",
                  badge: product.badge,
                  inStock: product.inStock,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-coal/20 py-20 text-center">
            <Store className="size-10 mx-auto text-coal/20" strokeWidth={1.2} />
            <p className="mt-4 font-display italic text-xl">No products yet</p>
            <p className="mt-2 text-sm text-coal/60">New products from this store will appear here.</p>
          </div>
        )}
      </section>
    </PageShell>
  );
}