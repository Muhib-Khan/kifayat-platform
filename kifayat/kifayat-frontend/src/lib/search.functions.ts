/**
 * Search functions backed by the Kifayat Express API.
 */
import { api, normalizeProduct, type UIProduct } from "./api";

export async function searchProducts(opts: {
  q: string;
  sort?: "relevance" | "newest" | "price_asc" | "price_desc" | "rating";
  brand?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  category?: string | null;
  page?: number;
}): Promise<{
  items: UIProduct[];
  facets: { brands: string[]; min_price: number; max_price: number } | null;
  total_pages: number;
  total: number;
}> {
  if (!opts.q?.trim()) {
    return { items: [], facets: null, total_pages: 1, total: 0 };
  }

  const sortMap: Record<string, string> = {
    relevance: "",
    newest: "",
    price_asc: "price_asc",
    price_desc: "price_desc",
    rating: "trending",
  };

  const params = new URLSearchParams();
  params.set("search", opts.q);
  if (opts.sort && sortMap[opts.sort]) params.set("sort", sortMap[opts.sort]);
  if (opts.page) params.set("page", String(opts.page));
  // Pass filters to the API; the server applies them to the full result set
  // (so count/total_pages stay correct across pages).
  if (opts.brand) params.set("brand", opts.brand);
  if (opts.min_price != null) params.set("min_price", String(opts.min_price));
  if (opts.max_price != null) params.set("max_price", String(opts.max_price));
  if (opts.category) params.set("category", opts.category);
  params.set("limit", "30");

  const data = await api.get<{
    success: boolean;
    products: any[];
    total: number;
    pages: number;
  }>(`/products?${params}`);

  // All filtering (brand/min_price/max_price) happens on the server. Never
  // filter client-side over already-paginated items — it would break
  // count/total_pages and page-to-page consistency.
  const items = (data.products ?? []).map(normalizeProduct);

  const prices = items.map((p) => p.price);
  return {
    items,
    facets:
      items.length > 0
        ? {
            brands: [],
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
          }
        : null,
    total_pages: data.pages ?? 1,
    total: data.total ?? items.length,
  };
}

export async function trendingSearches(): Promise<{ term: string; count: number }[]> {
  try {
    const data = await api.get<{
      success: boolean;
      trending?: { term: string; count: number }[];
    }>("/products/trending-searches?limit=8");
    return data.trending ?? [];
  } catch {
    return [];
  }
}

export async function searchSuggest(
  q: string,
  opts?: { limit?: number },
): Promise<{ queries: string[]; products: UIProduct[] }> {
  if (!q.trim()) return { queries: [], products: [] };
  try {
    const params = new URLSearchParams({ q });
    params.set("limit", String(opts?.limit ?? 8));
    const data = await api.get<{
      success: boolean;
      queries?: string[];
      products?: any[];
    }>(`/products/suggest?${params}`);
    const products = (data.products ?? []).map(normalizeProduct);
    return { queries: data.queries ?? [], products };
  } catch {
    return { queries: [], products: [] };
  }
}
