import { Heart } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isWishlisted, toggleWishlist } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function WishlistButton({ productId, className = "" }: { productId: string; className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["wishlisted", productId, user?._id],
    queryFn: () => isWishlisted(productId),
    enabled: !!user,
  });
  const wished = !!data?.wishlisted;

  async function click() {
    if (!user) { toast.error("Sign in to use wishlist."); return; }
    try {
      const res = await toggleWishlist(productId);
      toast.success(res.added ? "Added to wishlist." : "Removed from wishlist.");
      qc.invalidateQueries({ queryKey: ["wishlisted", productId] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }

  if (!user) {
    return (
      <Link to="/auth" className={`inline-flex items-center justify-center gap-2 ${className}`}>
        <Heart className="size-3.5" strokeWidth={1.5} /> Sign in to save
      </Link>
    );
  }

  return (
    <button onClick={click} className={`inline-flex items-center justify-center gap-2 ${className}`}>
      <Heart className={`size-3.5 ${wished ? "fill-brass text-brass" : ""}`} strokeWidth={1.5} />
      {wished ? "Saved" : "Save to wishlist"}
    </button>
  );
}
