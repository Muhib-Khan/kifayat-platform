import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/shop.functions";
import { resolveImage } from "@/lib/product-image-map";
import { useRef } from "react";

function smartTitle(name: string, max = 28): string {
  return name.length > max ? name.slice(0, max).trimEnd() + "â€¦" : name;
}

export function FlashDeals() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products", "flash", 12],
    queryFn: () => listProducts({ limit: 12 }),
    staleTime: 120_000,
  });

  const items = data?.products ?? [];

  return (
    <section className="bg-coal py-14 lg:py-20 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8 lg:mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="size-4 text-brass" strokeWidth={1.5} />
              <p className="eyebrow text-brass text-xs tracking-widest">Hot Right Now</p>
            </div>
            <h2 className="font-display italic text-4xl lg:text-6xl text-bone leading-[0.9]">
              Shop the<br />
              <span className="text-brass-deep">Moment.</span>
            </h2>
          </div>
          <Link
            to="/products"
            className="hidden sm:inline-flex items-center gap-2 eyebrow text-bone/60 hover:text-brass transition-colors text-xs border-b border-bone/20 hover:border-brass pb-0.5"
          >
            View all <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
          </Link>
        </div>

        {/* Horizontal scroll strip */}
        {isLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-none w-44 lg:w-52">
                <div className="aspect-square bg-bone/10 animate-pulse mb-3" />
                <div className="h-3 bg-bone/10 animate-pulse rounded mb-2 w-3/4" />
                <div className="h-3 bg-bone/10 animate-pulse rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-4 lg:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-5 lg:-mx-10 px-5 lg:px-10"
          >
            {items.map((p) => (
              <div
                key={p.id}
                className="flex-none w-40 sm:w-44 lg:w-52 group"
              >
                <Link to="/products/$productId" params={{ productId: p.slug }}>
                  {/* Square image */}
                  <div className="relative aspect-square bg-bone/8 overflow-hidden mb-3">
                    <img
                      src={resolveImage(p.image_url, p.slug, 600)}
                      alt={p.name}
                      loading="lazy"
                      width={600}
                      height={600}
                      className="size-full object-contain transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-[1.07]"
                    />
                    {p.badge && (
                      <span className="absolute top-2 left-2 bg-brass text-coal eyebrow px-2 py-0.5 text-[10px]">
                        {p.badge}
                      </span>
                    )}
                    {/* quick-view overlay */}
                    <div className="absolute inset-0 bg-coal/40 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="eyebrow text-bone text-[11px] flex items-center gap-1">
                        View <ArrowUpRight className="size-3" strokeWidth={1.5} />
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <p className="text-bone/80 eyebrow text-[10px] mb-1">{p.brand ?? "Kifayat"}</p>
                  <p className="text-bone text-sm font-medium leading-snug mb-1.5 group-hover:text-brass transition-colors">
                    {smartTitle(p.name)}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-brass text-base">
                      Rs {Number(p.price).toLocaleString()}
                    </span>
                    {p.old_price && (
                      <span className="text-bone/30 text-xs line-through">
                        Rs {Number(p.old_price).toLocaleString()}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Mobile "see all" */}
        <div className="mt-8 flex justify-center sm:hidden">
          <Link to="/products"
            className="inline-flex items-center gap-2 border border-bone/20 text-bone eyebrow text-xs px-6 py-3 hover:border-brass hover:text-brass transition-colors">
            Browse all products <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
