import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

/**
 * Listens for the `pricing_updated` Socket.io event emitted by the backend
 * after a bulk price change and immediately invalidates every product-related
 * query so all surfaces (landing, shop, search, product detail) refetch fresh
 * prices without requiring a page reload.
 */
export function usePricingSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handlePricingUpdated = (data: { all?: boolean; category?: string; percentage?: number; source?: string }) => {
      // Invalidate every query whose key starts with "products" or "lookbook"
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["lookbook"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["flash-deals"] });
      qc.invalidateQueries({ queryKey: ["featured"] });

      // During an HHC sync the final products_updated event already covers the
      // refresh with a single summary toast — don't stack a second one.
      if (data?.source === "hhc-sync") return;

      if (data?.all) {
        toast.info("Prices updated across the store.");
      } else if (data?.category) {
        toast.info(`Prices updated for ${data.category}.`);
      }
    };

    socket.on("pricing_updated", handlePricingUpdated);
    return () => { socket.off("pricing_updated", handlePricingUpdated); };
  }, [qc]);
}
