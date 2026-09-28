import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

/**
 * Listens for product-level socket events emitted by the backend and
 * immediately invalidates the relevant TanStack Query caches so every
 * surface refreshes without a page reload.
 *
 * Events handled:
 *  - products_updated     → new/changed products (import, bulk edit, recategorize)
 *  - product_out_of_stock → a specific product hit zero stock
 *  - product_deleted      → a product was permanently removed
 *  - products_cleared     → admin wiped the entire catalogue
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    // ── All product lists & detail pages need fresh data ─────────────────────
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["lookbook"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["flash-deals"] });
      qc.invalidateQueries({ queryKey: ["featured"] });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["hero"] });
      qc.invalidateQueries({ queryKey: ["similar"] });
      qc.invalidateQueries({ queryKey: ["product-search"] });
      qc.invalidateQueries({ queryKey: ["header-suggest"] });
    };

    // products_updated: emitted once after HHC import (quick fetch) or after a
    // full HHC sync completes, plus bulk edits, out-of-stock cleanup, and
    // recategorize completion. During syncAll the backend only emits this at
    // the very end — every surface refreshes together in one clean swap.
    const onProductsUpdated = (data: {
      source?: string;
      created?: number;
      updated?: number;
      deleted?: number;
      totalCreated?: number;
      totalUpdated?: number;
      deletedCount?: number;
      outOfStockDeleted?: number;
      remainingCount?: number;
      aborted?: boolean;
    }) => {
      invalidateAll();
      const src = data?.source;
      if (src === "hhc-sync" && data?.aborted) {
        toast.warning(
          `Sync stopped — catalogue partially updated (${data.totalCreated ?? 0} new, ${data.totalUpdated ?? 0} updated).`,
        );
      } else if (src === "hhc-sync") {
        toast.success(
          `Catalogue synced — ${data.totalCreated ?? 0} new, ${data.totalUpdated ?? 0} updated, ${(data.deletedCount ?? 0) + (data.outOfStockDeleted ?? 0)} removed.`,
        );
      } else if (src === "hhc-import") {
        toast.info(`Catalogue updated — ${data.created ?? 0} new, ${data.updated ?? 0} updated.`);
      } else if (src === "recategorize") {
        toast.info(`Products re-categorised — ${data.updated ?? 0} reassigned.`);
      } else if (src === "out-of-stock-cleanup") {
        toast.info(`${data.deleted ?? 0} out-of-stock product(s) removed.`);
      } else {
        toast.info("Product catalogue updated.");
      }
    };

    // product_out_of_stock: a single item just hit zero stock
    const onProductOutOfStock = (data: { productId?: string; name?: string }) => {
      invalidateAll();
      if (data?.name) toast.warning(`"${data.name}" is now out of stock.`);
    };

    // product_deleted: a single item was permanently deleted
    const onProductDeleted = (data: { productId?: string }) => {
      if (data?.productId) {
        qc.removeQueries({ queryKey: ["product", data.productId] });
      }
      invalidateAll();
    };

    // products_cleared: admin wiped everything
    const onProductsCleared = () => {
      invalidateAll();
      toast.warning("All products have been removed from the catalogue.");
    };

    socket.on("products_updated", onProductsUpdated);
    socket.on("product_out_of_stock", onProductOutOfStock);
    socket.on("product_deleted", onProductDeleted);
    socket.on("products_cleared", onProductsCleared);

    return () => {
      socket.off("products_updated", onProductsUpdated);
      socket.off("product_out_of_stock", onProductOutOfStock);
      socket.off("product_deleted", onProductDeleted);
      socket.off("products_cleared", onProductsCleared);
    };
  }, [qc]);
}
