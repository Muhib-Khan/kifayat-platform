import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Realtime order-status notifications for the signed-in customer.
 *
 * Two paths:
 *  1. Live — the admin updates a status while the user has the site open;
 *     the backend broadcasts `order_status_updated` and we toast instantly.
 *  2. Visit — the update happened while the user was away; on their next load
 *     we diff the tracked orders' statusUpdatedAt against a localStorage
 *     last-seen map and toast for anything newer.
 *
 * Both paths also invalidate the order query caches so the "Your Orders" and
 * "Orders" pages always show the fresh status.
 */

const LAST_SEEN_KEY = "kifayat.order-status.seen.v1";
const STOCK_SEEN_KEY = "kifayat.order-stock.seen.v1";

function loadSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSeen(seen: Record<string, string>) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

function loadStockSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STOCK_SEEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveStockSeen(seen: Record<string, string>) {
  try {
    localStorage.setItem(STOCK_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

function displayOrderNumber(orderID: string): string {
  if (!orderID) return "";
  return orderID.startsWith("KO-")
    ? orderID
    : `KFY-${String(orderID).slice(-6).toUpperCase()}`;
}

function notify(orderID: string, status: string) {
  const num = displayOrderNumber(orderID);
  toast.success(`Your order ${num} is now ${status}.`);
}

function notifyStock(orderID: string, productName: string, cancelled?: boolean) {
  const num = displayOrderNumber(orderID);
  const item = productName ? `"${productName}"` : "One of your items";
  if (cancelled) {
    toast.info(
      `We're sorry — ${item} has been out of stock, so your order ${num} cannot be fulfilled as placed. You may proceed to enjoy the rest of the shopping experience.`,
    );
  } else {
    toast.info(
      `${item} has been out of stock. You may proceed to enjoy the rest of the shopping experience.`,
    );
  }
}

export function useOrderStatusSync() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?._id ?? null;
  const handled = useRef<Record<string, string>>({});

  // ── Live socket updates ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["your-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    };

    const onStatus = (data: any) => {
      // When signed out there is no way to verify the broadcast belongs to
      // us — displaying it would leak another customer's order update.
      if (!userId) return;

      const targetId = data?.userId ? String(data.userId) : null;
      // A user id we know and it isn't ours → ignore. When the record has no
      // user id (older exports) fall back to email equality.
      if (targetId && userId && targetId !== userId) return;
      if (!targetId && data?.email && user?.email && String(data.email).toLowerCase() !== String(user.email).toLowerCase()) return;

      const orderID = data?.orderID ?? "";
      const status = data?.status ?? "";
      if (!orderID || !status) return;

      // De-dupe — a reconnect can replay events; only toast each update once.
      const key = `${orderID}:${status}:${data?.updatedAt ?? ""}`;
      if (handled.current[key]) return;
      handled.current[key] = "1";

      notify(orderID, status);
      invalidate();
    };

    const onStockAlert = (data: any) => {
      // Same ownership check as status updates — never leak another
      // customer's alert to us.
      if (!userId) return;

      const targetId = data?.userId ? String(data.userId) : null;
      if (targetId && userId && targetId !== userId) return;
      if (!targetId && data?.email && user?.email && String(data.email).toLowerCase() !== String(user.email).toLowerCase()) return;

      const orderID = data?.orderID ?? "";
      if (!orderID) return;

      // De-dupe — a reconnect can replay events; only toast once per alert.
      const key = `stock:${orderID}:${data?.productId ?? ""}:${data?.notifiedAt ?? ""}`;
      if (handled.current[key]) return;
      handled.current[key] = "1";

      notifyStock(orderID, data?.productName ?? "", data?.cancelled === true);
      invalidate();
    };

    socket.on("order_status_updated", onStatus);
    socket.on("order_product_out_of_stock", onStockAlert);
    return () => {
      socket.off("order_status_updated", onStatus);
      socket.off("order_product_out_of_stock", onStockAlert);
    };
  }, [qc, userId, user?.email]);

  // ── Visit detection (updates that happened while away) ──────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    api
      .get<{ success: boolean; orders: any[] }>("/orders/tracked")
      .then((data) => {
        if (cancelled) return;
        const seen = loadSeen();
        const changed: { orderID: string; status: string }[] = [];
        for (const o of data.orders ?? []) {
          const ts = o?.statusUpdatedAt ? String(o.statusUpdatedAt) : "";
          if (!ts) continue;
          const orderID = String(o?.orderID ?? o?.id ?? "");
          // Only toast orders we have seen before — the first run after this
          // feature ships quietly records statuses instead of spamming.
          if (seen[orderID] !== undefined && seen[orderID] !== ts) {
            changed.push({ orderID, status: String(o?.status ?? "pending") });
          }
          seen[orderID] = ts;
        }
        // Always persist the refreshed timestamps — otherwise a status that
        // was already toasted would be re-toasted on every later visit.
        saveSeen(seen);
        if (changed.length > 0) {
          const [latest, ...rest] = changed;
          notify(latest.orderID, latest.status);
          if (rest.length > 0) {
            toast.info(`…and ${rest.length} more order update${rest.length !== 1 ? "s" : ""}.`);
          }
        }

        // Stock alerts that arrived while the user was away — same "toast on
        // next visit" behaviour, keyed separately so status timestamps and
        // stock alerts never clobber each other.
        const stockSeen = loadStockSeen();
        const stockChanged: { orderID: string; productName: string }[] = [];
        for (const o of data.orders ?? []) {
          const orderID = String(o?.orderID ?? o?.id ?? "");
          for (const a of o?.stockAlerts ?? []) {
            const ts = a?.notifiedAt ? String(a.notifiedAt) : "";
            const pid = String(a?.productId ?? "");
            if (!orderID || !ts) continue;
            const key = `${orderID}:${pid}`;
            if (stockSeen[key] !== ts) {
              stockChanged.push({ orderID, productName: String(a?.productName ?? "") });
            }
            stockSeen[key] = ts;
          }
        }
        saveStockSeen(stockSeen);
        if (stockChanged.length > 0) {
          const [latest, ...rest] = stockChanged;
          // Persisted alerts only exist on OrderHistory (already-exported)
          // orders — queue orders are auto-cancelled instead, so the visit
          // toast never claims a cancelled order was fulfilled.
          notifyStock(latest.orderID, latest.productName, false);
          if (rest.length > 0) {
            toast.info(
              `…and ${rest.length} more item${rest.length !== 1 ? "s" : ""} you ordered have been out of stock. You may proceed to enjoy the rest of the shopping experience.`,
            );
          }
        }
      })
      .catch(() => {
        /* ignore — offline or not signed in */
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);
}