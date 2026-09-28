import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ArrowUpRight, Check, ShoppingBag, Banknote, Zap, BadgeCheck, RotateCcw } from "lucide-react";
import { listFeaturedLandingProducts } from "@/lib/shop.functions";
import { isWishlisted, toggleWishlist } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth-store";
import { resolveImage, responsiveImageSet } from "@/lib/product-image-map";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

const WHY_KIFAYAT = [
  { icon: Banknote, title: "Cash on Delivery", text: "Pay when your order lands on your doorstep — no card, no risk." },
  { icon: Zap, title: "Fast Dispatch", text: "Orders ship within 24 hours, straight to your door nationwide." },
  { icon: BadgeCheck, title: "Verified Quality", text: "Every product is checked by hand before it leaves our shelves." },
  { icon: RotateCcw, title: "Easy Returns", text: "Changed your mind? 7-day returns, no questions asked." },
];

function WishlistHeart({ productId, slug }: { productId: string; slug: string }) {
  const wishKey = productId || slug;
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["wishlisted", wishKey, user?._id],
    queryFn: () => isWishlisted(wishKey),
    enabled: !!user,
  });
  const wished = !!data?.wishlisted;
  async function toggleWish() {
    if (!user) {
      toast.error("Sign in to save items.");
      navigate({ to: "/auth" });
      return;
    }
    try {
      const res = await toggleWishlist(wishKey);
      toast.success(res.added ? "Added to wishlist." : "Removed from wishlist.");
      qc.invalidateQueries({ queryKey: ["wishlisted", wishKey] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update wishlist.");
    }
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleWish(); }
      }}
      aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWish(); }}
      className="absolute top-2.5 right-2.5 size-11 grid place-items-center text-coal/60 hover:text-coal hover:bg-bone/90 rounded-full transition cursor-pointer"
    >
      <Heart className={`size-3.5 ${wished ? "fill-brass text-brass" : ""}`} strokeWidth={1.4} />
    </span>
  );
}

const FEATURED_LIMIT = 80;

export function Products() {
  const t = useT();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", "featured-landing"],
    queryFn: () => listFeaturedLandingProducts(FEATURED_LIMIT),
    staleTime: 60_000,
  });

  const featured = (data ?? []).slice(0, FEATURED_LIMIT);

  return (
    <section className="bg-paper py-16 lg:py-28">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">

        {/* ── Section header — Daraz-style: title + See All on same row ── */}
        <div className="flex items-end justify-between mb-8 lg:mb-14">
          <div>
            <p className="eyebrow text-coal/80 mb-2 text-xs">The Weekly Edit · Ready to dispatch</p>
            <h2 className="font-display italic text-4xl lg:text-7xl leading-[0.9]">
              Curated Picks<span className="text-brass-deep">.</span>
            </h2>
          </div>
          <Link
            to="/products"
            className="hidden sm:inline-flex items-center gap-2 border border-coal/20 px-5 py-2.5 eyebrow text-xs hover:bg-coal hover:text-bone hover:border-coal transition-colors duration-300"
          >
            See all <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
          </Link>
        </div>
        <div className="mb-8 lg:mb-10 flex items-center gap-3 border-y border-coal/10 py-3.5 text-[11px] text-coal/85">
          <ShoppingBag className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <span>Every price is in PKR.</span>
          <span className="text-coal/20">|</span>
          <Check className="size-3 text-brass shrink-0" strokeWidth={2} />
          <span>Cash on delivery available.</span>
          <Link to="/shipping-policy" className="ml-auto underline underline-offset-4 hover:text-coal transition-colors whitespace-nowrap">Delivery details</Link>
        </div>

        {/* ── 4-col product grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-10 lg:gap-x-5 lg:gap-y-12">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-square bg-bone/50 animate-pulse" />
                <div className="h-3 bg-bone/50 animate-pulse rounded w-3/4" />
                <div className="h-3 bg-bone/50 animate-pulse rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="border-y border-coal/10 py-12 text-center">
            <p className="font-display italic text-3xl">The edit is taking a moment<span className="text-brass">.</span></p>
            <p className="mt-2 text-sm text-coal/85">Please try again, or browse the full catalogue.</p>
            <button type="button" onClick={() => refetch()} className="mt-6 border border-coal/20 px-5 py-2.5 eyebrow text-xs hover:bg-coal hover:text-bone transition-colors">
              Try again
            </button>
          </div>
        ) : featured.length === 0 ? (
          <div className="border-y border-coal/10 py-12 text-center">
            <p className="font-display italic text-3xl">New pieces are on their way<span className="text-brass">.</span></p>
            <p className="mt-2 text-sm text-coal/85">Browse the full catalogue to find something considered.</p>
            <Link to="/products" className="mt-6 inline-flex border border-coal/20 px-5 py-2.5 eyebrow text-xs hover:bg-coal hover:text-bone transition-colors">
              Browse all products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-10 lg:gap-x-5 lg:gap-y-12">
            {featured.map((p) => (
              <article
                key={p.id}
                className="group"
              >
                <Link to="/products/$productId" params={{ productId: p.slug }} aria-label={p.name} className="block">
                  <div className="relative aspect-square bg-bone overflow-hidden rounded-xl mb-3 lg:mb-4 img-bone-grade">
                    <img
                      src={resolveImage(p.image_url, p.slug, 600)}
                      srcSet={responsiveImageSet(resolveImage(p.image_url, p.slug))}
                      sizes="(min-width: 1600px) 240px, (min-width: 1024px) calc((100vw - 180px) / 6), (min-width: 640px) calc((100vw - 72px) / 3), calc((100vw - 56px) / 2)"
                      decoding="async"
                      alt={p.name}
                      loading="lazy"
                      width={600}
                      height={600}
                      className={`size-full object-contain transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-[1.05] ${p.inStock === false ? "grayscale opacity-70" : ""}`}
                    />

                    {/* Sold out */}
                    {p.inStock === false && (
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="eyebrow bg-coal text-bone px-3 py-1.5">{t("btn.outOfStock")}</span>
                      </div>
                    )}

                    {/* Badge */}
                    {p.badge && p.inStock !== false && (
                      <span className="absolute top-2.5 left-2.5 bg-brass text-coal eyebrow px-2 py-0.5 text-[10px]">
                        {p.badge}
                      </span>
                    )}

                    {/* Wishlist */}
                    <WishlistHeart productId={p.id} slug={p.slug} />

                    {/* CTA strip — Daraz-style "Add to cart" bar on hover */}
                    <span className="absolute inset-x-0 bottom-0 h-10 bg-coal text-bone eyebrow text-xs flex items-center justify-center gap-1.5 translate-y-full [@media(hover:hover)]:group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                      Quick view <ArrowUpRight className="size-3" strokeWidth={1.5} />
                    </span>
                  </div>
                </Link>

                {/* Caption */}
                <div className="min-w-0">
                  <p className="eyebrow text-coal/70 mb-1 text-[10px]">{p.brand}</p>
                  <Link
                    to="/products/$productId"
                    params={{ productId: p.slug }}
                    className="block font-sans font-bold text-sm lg:text-base leading-snug truncate hover:text-brass transition-colors"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <p className="font-display text-xs sm:text-sm lg:text-base">
                      Rs {Number(p.price).toLocaleString()}
                    </p>
                    {p.old_price && (
                      <p className="text-[10px] text-coal/70 line-through">
                        Rs {Number(p.old_price).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── Bottom CTA ── */}
        <div className="mt-14 lg:mt-20 flex flex-wrap items-center justify-center gap-4" data-search-trigger>
          <Link to="/products"
            className="group inline-flex items-center gap-3 border border-coal/15 px-8 py-4 eyebrow text-sm hover:bg-coal hover:text-bone transition-colors duration-500">
            Explore the full catalogue
            <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" strokeWidth={1.5} />
          </Link>
          <Link to="/products" className="sm:hidden inline-flex items-center gap-2 text-sm text-coal/60 underline underline-offset-4 hover:text-coal">
            See all →
          </Link>
        </div>
      </div>
    </section>
  );
}
