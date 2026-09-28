import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listWishlist, toggleWishlist } from "@/lib/account.functions";
import { Heart, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { cart } from "@/lib/cart-store";
import { useT } from "@/lib/i18n";
import { optImage } from "@/lib/product-image-map";

export const Route = createFileRoute("/account/wishlist")({
  component: Wishlist,
});

function Wishlist() {
  const qc = useQueryClient();
  const t = useT();
  const { data = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: listWishlist,
  });

  async function remove(product_id: string) {
    try {
      await toggleWishlist(product_id);
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["wishlisted", product_id] });
      toast.success("Removed from wishlist.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed.");
    }
  }

  async function addToCart(w: any) {
    const p = w.product;
    if (!p) return;
    if (p.inStock === false) {
      toast.error(`${p.name} is out of stock.`);
      return;
    }
    cart.add({
      product_id: w.product_id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      price: Number(p.price) || 0,
      image: p.image_url || "",
      qty: 1,
    });
    toast.success(`${p.name} added to bag.`);
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-[3/4] rounded-xl animate-pulse bg-secondary" />
            <div className="h-3 w-3/4 rounded animate-pulse bg-secondary" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-coal/15">
        <Heart className="size-8 mx-auto text-coal/30 mb-4" strokeWidth={1.2} />
        <p className="text-muted-foreground mb-6">Your wishlist is empty.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-coal text-bone eyebrow px-6 py-3 hover:bg-brass hover:text-coal transition"
        >
          Discover the edit <ArrowUpRight className="size-4" strokeWidth={1.5} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-muted-foreground">§ Saved for later</p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
          Wishlist<span className="text-brass">.</span>
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {data.length} saved item{data.length !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {data.map((w: any) => {
          const p = w.product;
          return (
            <div key={w.wishlist_id} className="group relative border border-coal/10 bg-card rounded-xl overflow-hidden">
              <Link to="/products/$productId" params={{ productId: p.slug }} className="block">
                <div className="relative aspect-square bg-paper overflow-hidden">
                  {p.image_url ? (
                    <img src={optImage(p.image_url, 600)} alt={p.name} loading="lazy" className={`size-full object-contain transition duration-500 [@media(hover:hover)]:group-hover:scale-105 ${p.inStock === false ? "grayscale opacity-70" : ""}`} />
                  ) : (
                    <div className="size-full grid place-items-center bg-bone">
                      <span className="font-display italic text-6xl text-coal/10">{(p.name || "K")[0]}</span>
                    </div>
                  )}
                  {p.inStock === false && (
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="eyebrow bg-coal text-bone px-3 py-1.5">{t("btn.outOfStock")}</span>
                    </div>
                  )}
                </div>
              </Link>
              <button
                onClick={() => remove(w.product_id)}
                aria-label="Remove from wishlist"
                className="absolute top-2.5 right-2.5 size-8 grid place-items-center bg-bone/85 text-coal/60 hover:text-red-600 hover:bg-bone rounded-full transition"
              >
                <Heart className="size-4 fill-current" strokeWidth={1.4} />
              </button>
              <div className="min-w-0 p-3 sm:p-4">
                <Link to="/products/$productId" params={{ productId: p.slug }} className="font-sans font-medium text-sm leading-snug line-clamp-2 hover:text-brass transition-colors">
                  {p.name}
                </Link>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-display italic font-bold text-base">Rs {Number(p.price).toLocaleString()}</span>
                  <button
                    onClick={() => addToCart(w)}
                    disabled={p.inStock === false}
                    className="text-[11px] eyebrow px-2.5 py-1.5 border border-coal/20 hover:bg-coal hover:text-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-coal"
                  >
                    {p.inStock === false ? t("btn.outOfStock") : t("btn.addToBag")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
