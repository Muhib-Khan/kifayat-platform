/**
 * Shop data functions — all backed by the Kifayat MongoDB/Express API.
 * These are plain async functions (no createServerFn / Supabase).
 */
import { api, normalizeProduct, type UIProduct } from "./api";

export type { UIProduct as DBProduct };

// ─── Categories ────────────────────────────────────────────────────────────

export type DBCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  productCount: number;
};

export async function listCategories(): Promise<DBCategory[]> {
  try {
    const data = await api.get<{ success: boolean; categories: any[] }>(
      "/products/categories",
    );
    return (data.categories ?? []).map((cat: any, i: number) => ({
      id: cat._id ?? cat.slug ?? cat.name,
      slug: cat.slug ?? cat.name.toLowerCase().replace(/[\s/]+/g, "-"),
      name: cat.name,
      description: null,
      image_url: cat.image || null,
      sort_order: i,
      productCount: cat.productCount ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function listPublicStats(): Promise<{ totalProducts: number; totalCategories: number }> {
  try {
    const [productsData, catsData] = await Promise.all([
      api.get<{ success: boolean; total: number }>("/products?limit=1"),
      api.get<{ success: boolean; categories: any[] }>("/products/categories"),
    ]);
    return {
      totalProducts: productsData.total ?? 0,
      totalCategories: (catsData.categories ?? []).length,
    };
  } catch {
    return { totalProducts: 0, totalCategories: 0 };
  }
}

export type PublicProof = {
  orders: number;
  reviews: {
    id: string;
    name: string;
    rating: number;
    comment: string;
    city: string;
    createdAt?: string;
  }[];
  totalReviews: number;
  average: number;
};

export async function listPublicProof(): Promise<PublicProof> {
  try {
    const [ordersRes, reviewsRes] = await Promise.all([
      api.get<{ success: boolean; total: number }>("/orders/count"),
      api.get<{
        success: boolean;
        reviews: any[];
        totalReviews: number;
        average: number;
      }>("/website-reviews?filter=good&limit=4"),
    ]);
    return {
      orders: ordersRes.total ?? 0,
      reviews: (reviewsRes.reviews ?? []).map((r) => ({
        id: r._id ?? r.id ?? "",
        name: r.name ?? "Verified buyer",
        rating: r.rating ?? 5,
        comment: r.comment ?? "",
        city: r.city ?? "",
        createdAt: r.createdAt,
      })),
      totalReviews: reviewsRes.totalReviews ?? 0,
      average: reviewsRes.average ?? 0,
    };
  } catch {
    return { orders: 0, reviews: [], totalReviews: 0, average: 0 };
  }
}

export async function submitWebsiteReview(payload: {
  rating: number;
  comment: string;
}): Promise<void> {
  await api.post<{ success: boolean }>("/website-reviews", payload);
}

// ─── Products ──────────────────────────────────────────────────────────────

export type PaginatedProducts = {
  products: UIProduct[];
  total: number;
  pages: number;
};

export async function listProducts(opts?: {
  categorySlug?: string;
  featured?: boolean;
  limit?: number;
  search?: string;
  sort?: string;
  page?: number;
}): Promise<PaginatedProducts> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.categorySlug) params.set("category", opts.categorySlug);

  const data = await api.get<{
    success: boolean;
    products: any[];
    total: number;
    pages: number;
  }>(`/products?${params}`);
  return {
    products: (data.products ?? []).map(normalizeProduct),
    total: data.total ?? 0,
    pages: data.pages ?? 1,
  };
}

export type HeroObjects = { left: string | null; right: string | null };

export async function getHeroObjects(): Promise<HeroObjects> {
  try {
    const data = await api.get<{ success: boolean; heroObjects?: HeroObjects }>(
      "/settings/public",
    );
    return {
      left: data.heroObjects?.left ?? null,
      right: data.heroObjects?.right ?? null,
    };
  } catch {
    return { left: null, right: null };
  }
}

export async function listFeaturedLandingProducts(limit = 8): Promise<UIProduct[]> {
  try {
    const data = await api.get<{ success: boolean; products: any[] }>(
      `/products/featured-landing?limit=${limit}`,
    );
    return (data.products ?? []).map(normalizeProduct);
  } catch {
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<UIProduct | null> {
  try {
    // Backend has no slug search endpoint; search by name match or use _id
    // We fetch by _id if slug looks like MongoDB ObjectId, else search
    const data = await api.get<{ success: boolean; products: any[] }>(
      `/products?search=${encodeURIComponent(slug)}&limit=1`,
    );
    const products = data.products ?? [];
    // Try exact slug match first
    const match = products.find((p: any) => {
      const pSlug = p.slug || p.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return pSlug === slug;
    });
    if (match) return normalizeProduct(match);
    if (products.length > 0) return normalizeProduct(products[0]);
    return null;
  } catch {
    return null;
  }
}

export async function getProductById(id: string): Promise<UIProduct | null> {
  try {
    const data = await api.get<{ success: boolean; product: any }>(`/products/${id}`);
    return data.product ? normalizeProduct(data.product) : null;
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

export async function getSimilarProducts(id: string): Promise<UIProduct[]> {
  try {
    const data = await api.get<{ success: boolean; products: any[] }>(
      `/products/${id}/similar`,
    );
    return (data.products ?? []).map(normalizeProduct);
  } catch {
    return [];
  }
}

// ─── Orders ────────────────────────────────────────────────────────────────

export type CheckoutItem = {
  product_id: string | null;
  product_name: string;
  product_slug?: string | null;
  unit_price: number;
  quantity: number;
  variation?: string;
};

export type CreateOrderInput = {
  contact_name: string;
  contact_phone: string;
  contact_email?: string | null;
  house_number?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  province: string;
  postal_code?: string | null;
  notes?: string | null;
  shipping: number;
  items: CheckoutItem[];
};

export async function createOrder(input: CreateOrderInput): Promise<{
  order_number: string;
  total: number;
}> {
  const address = [
    input.house_number,
    input.address_line1,
    input.address_line2,
    input.city,
    input.province,
    input.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  const data = await api.post<{ success: boolean; order: any; message?: string }>(
    "/orders",
    {
      items: input.items.map((i) => ({
        productId: i.product_id,
        quantity: i.quantity,
        variation: i.variation,
      })),
      shippingDetails: {
        name: input.contact_name,
        address,
        shpType: "Regular",
        courierCompany: "TCS",
        courierCity: input.city,
        phoneNumber: input.contact_phone,
        phoneNumber2: "",
        shipping: "cod",
        orderConEmail: input.contact_email || "",
        sellPrice: input.items.reduce(
          (s, i) => s + i.unit_price * i.quantity,
          0,
        ) + input.shipping,
      },
    },
  );

  const order = data.order;
  const orderNum = order?._id
    ? `KFY-${String(order._id).slice(-6).toUpperCase()}`
    : "KFY-000000";
  return {
    order_number: orderNum,
    total: order?.totalAmount ?? 0,
  };
}

export async function listMyOrders(): Promise<any[]> {
  const data = await api.get<{ success: boolean; orders: any[]; shippingMap: any }>(
    "/orders/my",
  );
  return (data.orders ?? []).map((o: any) => {
    const shipping = data.shippingMap?.[o._id] ?? {};
    return {
      id: o._id,
      order_number: `KFY-${String(o._id).slice(-6).toUpperCase()}`,
      total: o.totalAmount,
      status: o.status,
      created_at: o.createdAt,
      contact_name: shipping.name || "",
      city: shipping.courierCity || "",
      items: (o.items ?? []).map((i: any) => ({
        id: i._id,
        product_name: i.name,
        unit_price: i.price,
        quantity: i.quantity,
        variation: i.variation,
        line_total: i.price * i.quantity,
      })),
      address_line1: shipping.address || "",
      contact_phone: shipping.phoneNumber || "",
      contact_email: shipping.email || "",
      province: "",
      subtotal: o.totalAmount,
      shipping: 0,
      payment_method: shipping.shipping || "cod",
    };
  });
}

// ─── Your Orders (main-order tracking) ────────────────────────────────────
// Sourced from the main order CSV: confirmed orders awaiting export plus the
// exported OrderHistory archive. Status is managed by the admin in the
// "Order Status" panel and pushed to the customer in realtime.

export type TrackedOrderItem = {
  name: string;
  sku: string;
  variationName: string;
  price: number;
  quantity: number;
  imageUrl: string;
};

export type TrackedOrderStockAlert = {
  productId: string;
  productName: string;
  notifiedAt: string;
};

export type TrackedOrder = {
  id: string;
  orderID: string;
  order_number: string;
  status: string;
  statusUpdatedAt: string | null;
  name: string;
  city: string;
  address: string;
  phone: string;
  sellPrice: number;
  date: string;
  exported: boolean;
  items: TrackedOrderItem[];
  stockAlerts: TrackedOrderStockAlert[];
};

export async function listTrackedOrders(): Promise<TrackedOrder[]> {
  const data = await api.get<{ success: boolean; orders: any[] }>("/orders/tracked");
  return (data.orders ?? []).map((o: any) => ({
    id: o.id ?? "",
    orderID: o.orderID ?? "",
    order_number: o.orderID?.startsWith?.("KO-")
      ? o.orderID
      : `KFY-${String(o.orderID || o.id).slice(-6).toUpperCase()}`,
    status: o.status ?? "pending",
    statusUpdatedAt: o.statusUpdatedAt ?? null,
    name: o.name ?? "",
    city: o.city ?? "",
    address: o.address ?? "",
    phone: o.phone ?? "",
    sellPrice: Number(o.sellPrice ?? 0),
    date: o.exportedAt ?? o.createdAt ?? "",
    exported: o.source !== "queue",
    items: (o.products ?? []).map((p: any) => ({
      name: p.name ?? "",
      sku: p.sku ?? "",
      variationName: p.variationName ?? "",
      price: Number(p.price ?? 0),
      quantity: Number(p.quantity ?? 1),
      imageUrl: p.imageUrl ?? "",
    })),
    stockAlerts: (o.stockAlerts ?? []).map((a: any) => ({
      productId: String(a?.productId ?? ""),
      productName: String(a?.productName ?? ""),
      notifiedAt: String(a?.notifiedAt ?? ""),
    })),
  }));
}

export async function cancelTrackedOrder(orderId: string, reason?: string): Promise<any> {
  return api.post<any>(`/orders/tracked/${orderId}/cancel`, { reason });
}

export async function resendOrderConfirmation(orderNumber: string): Promise<any> {
  return api.post<any>(`/orders/resend-confirmation/${orderNumber}`);
}

// ─── Profile ───────────────────────────────────────────────────────────────

// ── Tier definitions (mirrors backend config/tiers.js) ──────────────────────
export const TIERS = {
  bronze: {
    label: "Bronze",
    emoji: "🥉",
    color: "#CD7F32",
    minOrders: 0,
    minSpent: 0,
    bgGrad: "from-amber-700/20 to-amber-900/10",
    borderGrad: "amber-700/30",
    perks: [
      { icon: "Package", label: "Standard order processing" },
    ],
  },
  silver: {
    label: "Silver",
    emoji: "🥈",
    color: "#A8A8A8",
    minOrders: 3,
    minSpent: 5000,
    bgGrad: "from-gray-400/20 to-gray-500/10",
    borderGrad: "gray-400/30",
    perks: [
      { icon: "Zap", label: "Priority order processing" },
      { icon: "Truck", label: "Flat delivery — cheapest in Pakistan" },
      { icon: "ShieldCheck", label: "Exclusive Silver badge" },
    ],
  },
  gold: {
    label: "Gold",
    emoji: "🥇",
    color: "#FFD700",
    minOrders: 10,
    minSpent: 25000,
    bgGrad: "from-yellow-500/20 to-yellow-600/10",
    borderGrad: "yellow-500/30",
    perks: [
      { icon: "Zap", label: "VIP order processing" },
      { icon: "Truck", label: "Flat delivery — cheapest in Pakistan" },
      { icon: "Star", label: "Early access to new products" },
      { icon: "Gift", label: "Birthday surprise" },
      { icon: "ShieldCheck", label: "Exclusive Gold badge" },
    ],
  },
  platinum: {
    label: "Platinum",
    emoji: "💎",
    color: "#E5E4E2",
    minOrders: 25,
    minSpent: 75000,
    bgGrad: "from-purple-400/20 to-purple-600/10",
    borderGrad: "purple-400/30",
    perks: [
      { icon: "Zap", label: "Personal concierge support" },
      { icon: "Truck", label: "Flat delivery — cheapest in Pakistan" },
      { icon: "Star", label: "Early access to new products" },
      { icon: "Gift", label: "Birthday surprise" },
      { icon: "Timer", label: "Fastest processing priority" },
      { icon: "ShieldCheck", label: "Exclusive Platinum badge" },
      { icon: "Calendar", label: "Invite to exclusive events" },
    ],
  },
} as const;

export type TierKey = keyof typeof TIERS;

export async function getMyProfile(): Promise<{
  profile: {
    full_name: string;
    phone: string | null;
    gender: string | null;
    avatar: string | null;
    dateOfBirth: string | null;
    memberSince: string | null;
    lastActive: string | null;
    isVerifiedCustomer: boolean;
    tier: TierKey;
    loyaltyPoints: number;
    totalOrdersCount: number;
    totalSpentAmount: number;
    customDiscountPercent: number;
    priceMultiplier: number;
  } | null;
  email: string | null;
}> {
  const data = await api.get<{ success: boolean; user: any }>("/auth/me");
  if (!data.user) return { profile: null, email: null };
  return {
    profile: {
      full_name: data.user.name ?? "",
      phone: data.user.phone ?? null,
      gender: data.user.gender ?? null,
      avatar: data.user.avatar ?? null,
      dateOfBirth: data.user.dateOfBirth ?? null,
      memberSince: data.user.createdAt ?? null,
      lastActive: data.user.lastActiveAt ?? null,
      isVerifiedCustomer: data.user.isVerifiedCustomer ?? false,
      tier: data.user.tier ?? "bronze",
      loyaltyPoints: data.user.loyaltyPoints ?? 0,
      totalOrdersCount: data.user.totalOrdersCount ?? 0,
      totalSpentAmount: data.user.totalSpentAmount ?? 0,
      customDiscountPercent: data.user.customDiscountPercent ?? 0,
      priceMultiplier: data.user.priceMultiplier ?? 70,
    },
    email: data.user.email ?? null,
  };
}

export async function updateMyProfile(input: {
  full_name: string;
  phone?: string | null;
  gender?: string | null;
  avatar?: string | null;
  dateOfBirth?: string | null;
}): Promise<{ ok: boolean }> {
  await api.put("/auth/profile", {
    name: input.full_name,
    phone: input.phone,
    gender: input.gender,
    avatar: input.avatar,
    dateOfBirth: input.dateOfBirth,
  });
  return { ok: true };
}
