import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type CartItem = {
  product_id: string | null;
  slug: string;
  name: string;
  brand: string | null;
  /** Effective unit price — the voucher price when a voucher is applied. */
  price: number;
  /** Base price before the applied voucher (set only when a voucher is applied). */
  original_price?: number;
  /** Applied voucher metadata (set only when a voucher is applied to this item). */
  voucher?: { voucherId: string; percent: number };
  image: string;
  qty: number;
  /** Selected product variation label (e.g. the color/size option picked on the product page). */
  variation?: string;
};

const KEY = "kifayat.cart.v1";
type Listener = (items: CartItem[]) => void;
const listeners = new Set<Listener>();
let items: CartItem[] = [];
let hydrated = false;

/** A cart may hold several lines of the same product with different variations. */
function lineKey(item: { slug: string; variation?: string }): string {
  return item.variation ? `${item.slug}::${item.variation}` : item.slug;
}

function load() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) items = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}
function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(items));
}

export const cart = {
  get items() {
    load();
    return items;
  },
  add(item: Omit<CartItem, "qty"> & { qty?: number }) {
    load();
    const qty = item.qty ?? 1;
    const key = lineKey(item);
    const existing = items.find((i) => lineKey(i) === key);
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else items = [...items, { ...item, qty }];
    persist();
  },
  updateQty(slug: string, qty: number, variation?: string) {
    load();
    items = items.map((i) =>
      lineKey(i) === lineKey({ slug, variation })
        ? { ...i, qty: Math.max(1, Math.min(99, qty)) }
        : i,
    );
    persist();
  },
  remove(slug: string, variation?: string) {
    load();
    items = items.filter((i) => lineKey(i) !== lineKey({ slug, variation }));
    persist();
  },
  applyVoucher(slug: string, voucher: NonNullable<CartItem["voucher"]>) {
    load();
    items = items.map((i) => {
      if (i.slug !== slug) return i;
      const original = i.original_price ?? i.price;
      return {
        ...i,
        original_price: original,
        voucher,
        price: Math.round(original * (1 - voucher.percent / 100)),
      };
    });
    persist();
  },
  removeVoucher(slug: string) {
    load();
    items = items.map((i) => {
      if (i.slug !== slug || !i.voucher) return i;
      const { original_price, voucher, ...rest } = i;
      return { ...rest, price: original_price ?? i.price };
    });
    persist();
  },
  clear() {
    items = [];
    persist();
  },
};

export type StockWarning = {
  productId: string;
  name: string;
  available: number;
  requested: number;
  type: "unavailable" | "insufficient";
};

export type CartValidation = {
  valid: boolean;
  warnings: StockWarning[];
};

/**
 * Calls the backend validate endpoint and refreshes any cart item whose price
 * has changed since it was added to the cart. Also heals items with missing or
 * stale product ids by adopting the resolved _id from the backend. Returns
 * true if anything changed.
 */
export async function refreshCartPrices(): Promise<boolean> {
  load();
  if (items.length === 0) return false;
  try {
    const res = await fetch("/api/cart/validate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.product_id, slug: i.slug, quantity: i.qty })),
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.validItems)) return false;

    let changed = false;
    data.validItems.forEach((v: { productId: string; slug?: string; currentPrice?: number }) => {
      if (!v.productId || v.currentPrice == null) return;
      // Skip lines pinned to a specific variation — the backend validates at
      // product level and returns the retail price, so it cannot re-resolve a
      // variation's own price without clobbering it.
      const item = items.find((i) => i.slug === v.slug && !i.variation);
      if (!item) return;
      if (item.product_id !== v.productId) {
        item.product_id = v.productId;
        changed = true;
      }
      if (item.voucher) {
        // Rebase the voucher discount on the freshly validated price
        const base = v.currentPrice;
        const np = Math.round(base * (1 - item.voucher.percent / 100));
        if (item.original_price !== base || item.price !== np) {
          item.original_price = base;
          item.price = np;
          changed = true;
        }
      } else if (item.price !== v.currentPrice) {
        item.price = v.currentPrice;
        changed = true;
      }
    });
    if (changed) persist();
    return changed;
  } catch {
    return false;
  }
}

export async function validateCartStock(): Promise<CartValidation> {
  load();
  if (items.length === 0) return { valid: true, warnings: [] };
  try {
    const res = await fetch("/api/cart/validate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.product_id, slug: i.slug, quantity: i.qty })),
      }),
    });
    if (!res.ok) return { valid: false, warnings: [] };
    const data = await res.json();
    if (!data.success) return { valid: false, warnings: [] };

    const warnings: StockWarning[] = (data.warnings ?? []).filter(
      (w: StockWarning) => w.type === "unavailable" || w.type === "insufficient",
    );

    return {
      valid: warnings.length === 0,
      warnings,
    };
  } catch {
    return { valid: false, warnings: [] };
  }
}

export function useCart() {
  // Start empty on both server and first client render to avoid hydration mismatch.
  const [s, setS] = useState<CartItem[]>([]);
  useEffect(() => {
    load();
    setS(items);
    const l: Listener = (next) => setS(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

/** Flat delivery fee on every order — fallback default until the admin-editable value loads. */
export const FLAT_DELIVERY_FEE = 100;

/** Public settings endpoint the backend exposes for the admin-editable delivery fee. */
const PUBLIC_SETTINGS_PATH = "/settings/public";

/**
 * Fetch the admin-editable delivery fee from the public settings endpoint.
 * Returns FLAT_DELIVERY_FEE on any failure (offline, endpoint missing, bad payload).
 *
 * Concurrent calls (e.g. several product pages mounting at once) share one
 * in-flight request; a settled result is allowed to refetch on the next call
 * so admin edits to the fee still propagate on later mounts. Pure dedupe —
 * behaviour is unchanged, just fewer duplicate requests per browse session.
 */
let deliveryFeePromise: Promise<number> | null = null;

export async function fetchDeliveryFee(): Promise<number> {
  if (!deliveryFeePromise) {
    deliveryFeePromise = (async () => {
      try {
        const data = await api.get<{ success?: boolean; deliveryFee?: unknown }>(PUBLIC_SETTINGS_PATH);
        const fee = Number(data?.deliveryFee);
        return Number.isFinite(fee) && fee >= 0 ? fee : FLAT_DELIVERY_FEE;
      } catch {
        return FLAT_DELIVERY_FEE;
      }
    })();
    deliveryFeePromise.finally(() => {
      deliveryFeePromise = null;
    });
  }
  return deliveryFeePromise;
}

/**
 * The user-level discount percent applied to every order line at checkout —
 * the stronger of the admin-set customDiscountPercent and the user's
 * community buyer rate (priceMultiplier = % of retail the user pays).
 * The multiplier rate is a FIRST-PURCHASE PERK: it only applies while the
 * customer has no prior orders. Mirrors the backend orderController checkout.
 */
export function userDiscountPercent(user?: any): number {
  if (!user) return 0;
  return Math.min(100, Math.max(0, Number(user.customDiscountPercent) || 0));
}

/**
 * Displayed unit price for a cart line: user-level discount applied first,
 * voucher discount on top — identical to the backend checkout math.
 */
export function displayUnitPrice(i: CartItem, user?: any): number {
  const disc = userDiscountPercent(user);
  const base = i.original_price ?? i.price;
  const afterUser = Math.round(base * (1 - disc / 100));
  return i.voucher ? Math.round(afterUser * (1 - i.voucher.percent / 100)) : afterUser;
}

export function cartTotals(
  arr: CartItem[],
  deliveryFee: number = FLAT_DELIVERY_FEE,
  user?: any,
) {
  const subtotal = arr.reduce((s, i) => s + displayUnitPrice(i, user) * i.qty, 0);
  const shipping = arr.length === 0 ? 0 : Math.max(0, Number(deliveryFee) || FLAT_DELIVERY_FEE);
  const total = subtotal + shipping;
  const count = arr.reduce((s, i) => s + i.qty, 0);
  return { subtotal, shipping, total, count };
}
