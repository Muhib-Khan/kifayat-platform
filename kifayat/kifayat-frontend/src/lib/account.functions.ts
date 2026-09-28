/**
 * Account-level functions (addresses, wishlist, recently-viewed)
 * backed by the Kifayat Express API.
 *
 * NOTE: The MongoDB backend does not have address or wishlist tables.
 * These are stored in localStorage as a graceful fallback until the
 * backend grows those endpoints.
 */
import { api } from "./api";
import { getProductById } from "./shop.functions";

// ─── Addresses (localStorage shim) ────────────────────────────────────────

const ADDR_KEY = "kifayat.addresses.v1";

function loadAddresses(): any[] {
  try {
    return JSON.parse(localStorage.getItem(ADDR_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveAddresses(addrs: any[]) {
  localStorage.setItem(ADDR_KEY, JSON.stringify(addrs));
}

export async function listAddresses(): Promise<any[]> {
  return loadAddresses();
}

export async function upsertAddress(addr: any): Promise<{ ok: boolean; id: string }> {
  const addrs = loadAddresses();
  const id = addr.id || `addr-${Date.now()}`;
  const existing = addrs.findIndex((a) => a.id === id);
  const row = { ...addr, id };
  if (existing >= 0) addrs[existing] = row;
  else addrs.unshift(row);
  // Enforce default: clear others if this one is default
  if (row.is_default) addrs.forEach((a) => { if (a.id !== id) a.is_default = false; });
  saveAddresses(addrs);
  return { ok: true, id };
}

export async function deleteAddress(id: string): Promise<{ ok: boolean }> {
  saveAddresses(loadAddresses().filter((a) => a.id !== id));
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<{ ok: boolean }> {
  const addrs = loadAddresses().map((a) => ({
    ...a,
    is_default: a.id === id,
  }));
  saveAddresses(addrs);
  return { ok: true };
}

// ─── Wishlist (localStorage shim) ─────────────────────────────────────────

const WISH_KEY = "kifayat.wishlist.v1";

function loadWishlist(): { product_id: string; added_at: string }[] {
  try {
    return JSON.parse(localStorage.getItem(WISH_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveWishlist(items: any[]) {
  localStorage.setItem(WISH_KEY, JSON.stringify(items));
}

export async function listWishlist(): Promise<any[]> {
  const saved = loadWishlist();
  if (saved.length === 0) return [];
  const resolved = await Promise.all(
    saved.map(async (w) => {
      try {
        const product = await getProductById(w.product_id);
        if (!product) return null;
        return {
          wishlist_id: `wish-${w.product_id}`,
          added_at: w.added_at,
          product_id: w.product_id,
          product,
        };
      } catch {
        return null;
      }
    }),
  );
  return resolved.filter(Boolean);
}

export async function toggleWishlist(product_id: string): Promise<{ added: boolean }> {
  const list = loadWishlist();
  const idx = list.findIndex((w) => w.product_id === product_id);
  if (idx >= 0) {
    list.splice(idx, 1);
    saveWishlist(list);
    return { added: false };
  } else {
    list.unshift({ product_id, added_at: new Date().toISOString() });
    saveWishlist(list);
    return { added: true };
  }
}

export async function isWishlisted(product_id: string): Promise<{ wishlisted: boolean }> {
  return {
    wishlisted: loadWishlist().some((w) => w.product_id === product_id),
  };
}

// ─── Recently viewed (localStorage shim) ──────────────────────────────────

const RV_KEY = "kifayat.recently-viewed.v1";

export async function recordRecentlyViewed(product_id: string): Promise<void> {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RV_KEY) ?? "[]");
    const filtered = list.filter((id) => id !== product_id);
    filtered.unshift(product_id);
    localStorage.setItem(RV_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch {
    // ignore
  }
}

// ─── My reviews (from Express API) ────────────────────────────────────────

export async function listMyReviews(): Promise<any[]> {
  try {
    // The backend doesn't have a "my reviews" endpoint; return empty
    return [];
  } catch {
    return [];
  }
}
