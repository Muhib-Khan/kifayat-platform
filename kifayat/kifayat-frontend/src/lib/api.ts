/**
 * HTTP client for the Kifayat Express/MongoDB backend.
 * All requests go to /api (proxied by Vite to http://localhost:5000).
 * Cookies (httpOnly JWT) are included automatically via credentials: 'include'.
 */

const BASE = "/api";

async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return undefined as T;
  }

  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path, { method: "GET" }),
  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T = any>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  del: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Normalise a MongoDB product document to the shape the UI expects.
 * Supabase used snake_case field names; MongoDB uses camelCase.
 */
export type UIProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string;
  price: number;
  old_price: number | null;
  image_url: string | null;
  badge: string | null;
  stock: number;
  inStock: boolean;
  featured: boolean;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  salesCount?: number;
  // Extended product metadata
  sku?: string;
  weight?: number;
  videoUrl?: string;
  createdAt?: string;
  // Filled by the "Get Product Dynamic Data" admin action (HHC dynamic API)
  image_urls: string[];
  videos: string[];
  variations: any[];
  gallery: { id: unknown; url: string; type: "image" | "video" }[];
  // Admin-only fields (present when fetched via /products/admin-list)
  wholesalePrice?: number;
  hidden?: boolean;
  featuredOnLanding?: boolean;
  // Per-product SEO (admin-set or AI "SEO Booster"); drives site search and
  // the product page's meta/JSON-LD.
  keywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
};

/** Clean a potentially comma-separated / query-string-bearing image URL. */
function cleanImageUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const first = url.split(",")[0].split("?")[0].trim();
  return first || null;
}

/** Split a comma-joined field into clean non-empty strings. */
function cleanList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).split("?")[0].trim())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((s) => s.split("?")[0].trim())
    .filter(Boolean);
}

/** Normalize the ordered gallery ({ id, url, type }) from backend data. */
function normalizeGallery(p: any): { id: unknown; url: string; type: "image" | "video" }[] {
  if (Array.isArray(p.gallery)) {
    return p.gallery
      .map((g: any) => ({
        id: g?.id ?? null,
        url: String(g?.url ?? "").split("?")[0].trim(),
        type: g?.type === "video" ? "video" : "image",
      }))
      .filter((g: any) => g.url);
  }
  return [];
}

/** Derive a display badge from product data. */
function deriveBadge(p: any): string | null {
  // Out of stock takes priority (only truly zero-stock products)
  if (p.inStock === false || (typeof p.stock === "number" && p.stock <= 0)) {
    return "Out of Stock";
  }
  // "New" if created within the last 7 days
  if (p.createdAt) {
    const age = Date.now() - new Date(p.createdAt).getTime();
    if (age < 7 * 86_400_000) return "New";
  }
  return null;
}

export function normalizeProduct(p: any): UIProduct {
  const gallery = normalizeGallery(p);
  const fromGallery = gallery.length > 0;
  const image_urls = fromGallery
    ? gallery.filter((g) => g.type === "image").map((g) => g.url)
    : cleanList(p.imageUrl);
  const videos = fromGallery
    ? gallery.filter((g) => g.type === "video").map((g) => g.url)
    : cleanList(p.videos);

  return {
    id: p._id ?? p.id ?? "",
    slug: p.slug || (p._id ?? p.id ?? ""),
    name: p.name ?? "",
    brand: null,
    description: p.description ?? "",
    price: p.retailPrice ?? p.price ?? 0,
    old_price: null,
    image_url: cleanImageUrl(p.imageUrl),
    badge: deriveBadge(p),
    stock: typeof p.stock === "number" ? p.stock : (p.inStock === false ? 0 : 1),
    inStock: p.inStock !== false && (typeof p.stock === "number" ? p.stock > 0 : p.inStock !== false),
    featured: false,
    category_id: null,
    category_slug: p.category
      ? p.category.toLowerCase().replace(/[\s/]+/g, "-")
      : null,
    category_name: p.category || null,
    salesCount: p.salesCount,
    sku: p.sku || undefined,
    weight: typeof p.weight === "number" && p.weight > 0 ? p.weight : undefined,
    videoUrl: p.videoUrl || undefined,
    createdAt: p.createdAt || undefined,
    image_urls,
    videos,
    variations: Array.isArray(p.variations) ? p.variations : [],
    gallery,
    wholesalePrice: typeof p.wholesalePrice === "number" ? p.wholesalePrice : undefined,
    hidden: p.hidden ?? undefined,
    featuredOnLanding: p.featuredOnLanding ?? undefined,
    keywords: Array.isArray(p.keywords)
      ? p.keywords.filter((k: unknown) => String(k ?? "").trim())
      : undefined,
    seoTitle: p.seoTitle || undefined,
    seoDescription: p.seoDescription || undefined,
  };
}
