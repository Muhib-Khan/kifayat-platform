import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Heart, Check, Trash, Loader2 } from "lucide-react";
import { isWishlisted, toggleWishlist } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth-store";
import { adminDeleteProduct } from "@/lib/admin.functions";
import { toast } from "sonner";
import { fetchDeliveryFee } from "@/lib/cart-store";
import { useT } from "@/lib/i18n";
import { optImage, responsiveImageSet } from "@/lib/product-image-map";

export type CardProduct = {
  id?: string;
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  oldPrice?: number | null;
  image: string;
  badge?: string | null;
  inStock?: boolean;
};

export function ProductCard({ p, index }: { p: CardProduct; index?: number }) {
  const title = p.name;
  const wishKey = p.id || p.slug;
  const { user } = useAuth();

  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();
  const isAdmin = user?.role === "admin";

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteProduct(p.id || ""),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Product deleted.");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete."),
  });
  const { data } = useQuery({
    queryKey: ["wishlisted", wishKey, user?._id],
    queryFn: () => isWishlisted(wishKey),
    enabled: !!user,
  });
  const wished = !!data?.wishlisted;

  // Shared query key — React Query dedupes concurrent subscribers, so a grid
  // of 400 cards triggers exactly one /settings/public fetch.
  const { data: deliveryFee } = useQuery({
    queryKey: ["deliveryFee"],
    queryFn: fetchDeliveryFee,
    staleTime: 5 * 60 * 1000,
  });

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
    <article className="store-product-card group relative min-w-0">
      <Link
        to="/products/$productId"
        params={{ productId: p.slug }}
        className="block"
      >
        <div className="relative aspect-square bg-paper overflow-hidden rounded-xl img-bone-grade">
          {p.image ? (
            <img
              src={optImage(p.image, 900)}
              srcSet={responsiveImageSet(p.image)}
              sizes="(min-width: 1400px) 255px, (min-width: 1280px) calc((100vw - 360px) / 4), (min-width: 1024px) calc((100vw - 340px) / 3), (min-width: 640px) calc((100vw - 72px) / 3), calc((100vw - 44px) / 2)"
              alt={p.name}
              loading={typeof index === "number" && index < 4 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : undefined}
              decoding="async"
              width={900}
              height={900}
              className={`size-full object-contain img-breathe transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-[1.06] ${p.inStock === false ? "grayscale opacity-70" : ""}`}
            />
          ) : (
            <div className="size-full bg-bone grid place-items-center">
              <span className="font-display italic text-[96px] leading-none text-coal/10 select-none">
                {(p.name || "K")[0].toUpperCase()}
              </span>
            </div>
          )}

          {/* sold-out overlay */}
          {p.inStock === false && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="eyebrow bg-coal text-bone px-3 py-1.5">{t("btn.outOfStock")}</span>
            </div>
          )}

          {/* top meta — index + badge */}
          {typeof index === "number" && (
            <span className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 eyebrow text-coal/80 bg-bone/85 px-2 py-1 font-mono">
              N° {String(index + 1).padStart(2, "0")}
            </span>
          )}
          {p.badge && p.inStock !== false && (
            <span className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 bg-brass text-coal eyebrow px-2.5 py-1">{p.badge}</span>
          )}

          {/* wishlist */}
          <button
            aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWish(); }}
            className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 size-11 grid place-items-center bg-bone/85 text-coal hover:bg-coal hover:text-bone rounded-full transition
              opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:translate-y-2
              group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 duration-500
              [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0
              focus-visible:opacity-100 focus-visible:translate-y-0"
          >
            <Heart className={`size-4 ${wished ? "fill-brass text-brass" : ""}`} strokeWidth={1.4} />
          </button>

          {/* admin delete */}
          {isAdmin && (
            <button
              aria-label="Delete product"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm(`Delete "${p.name}" permanently?`)) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
              className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 size-11 grid place-items-center bg-red-500/90 text-white hover:bg-red-600 rounded-full transition shadow-lg
                opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:translate-y-2
                group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 duration-500
                [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0
                focus-visible:opacity-100 focus-visible:translate-y-0"
            >
              {deleteMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash className="size-4" strokeWidth={1.4} />}
            </button>
          )}
        </div>
      </Link>

      {/* caption */}
      <div className="store-product-caption mt-2.5 sm:mt-3.5 flex flex-col items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-coal/35 mb-1 text-[10px]">{p.brand}</p>
          <Link
            to="/products/$productId"
            params={{ productId: p.slug }}
            className="font-sans font-medium text-xs sm:text-sm lg:text-base leading-snug line-clamp-2 hover:text-brass transition-colors"
          >
            {title}
          </Link>
        </div>
        <div className="w-full min-w-0 break-words">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {p.oldPrice && p.oldPrice > p.price && (
              <span className="text-xs text-coal/40 line-through">Rs {p.oldPrice.toLocaleString()}</span>
            )}
            <p className="font-display italic text-sm sm:text-base lg:text-lg">
              Rs {p.price.toLocaleString()}
            </p>
          </div>
          <p className="mt-1 inline-flex items-center gap-1 text-[9px] text-coal/40">
            <Check className="size-2.5 text-brass" strokeWidth={2} /> Pay on delivery
          </p>
          {typeof deliveryFee === "number" && (
            <p className="mt-1 whitespace-nowrap text-[9px] text-coal/45">Rs {deliveryFee} delivery</p>
          )}
        </div>
      </div>
    </article>
  );
}
