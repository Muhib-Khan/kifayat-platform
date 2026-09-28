/**
 * Admin functions backed by the Kifayat Express API.
 */
import { api, normalizeProduct, BASE } from "./api";

// ─── Dashboard ─────────────────────────────────────────────────────────────

export async function adminDashboardStats(): Promise<any> {
  const [statsRes, ordersRes] = await Promise.all([
    api.get<{ success: boolean; stats: any }>("/products/stats"),
    api.get<{ success: boolean; orders: any[] }>("/orders"),
  ]);

  const orders = ordersRes.orders ?? [];
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);

  const orders30 = orders.filter((o) => new Date(o.createdAt) >= since30d);
  const orders7 = orders.filter((o) => new Date(o.createdAt) >= since7d);
  const ordersToday = orders.filter((o) => new Date(o.createdAt) >= startOfDay);

  const sum = (arr: any[]) =>
    arr.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

  // Revenue series — last 14 days
  const dayMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    dayMap.set(k, { date: k, revenue: 0, orders: 0 });
  }
  orders30.forEach((o: any) => {
    const k = o.createdAt?.slice(0, 10);
    if (k && dayMap.has(k)) {
      const e = dayMap.get(k)!;
      e.revenue += Number(o.totalAmount ?? 0);
      e.orders += 1;
    }
  });

  // Orders by status
  const statusMap = new Map<string, number>();
  orders30.forEach((o: any) => {
    statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  });
  const orders_by_status = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

  // Top products by salesCount
  const stats = statsRes.stats ?? {};

  return {
    kpi: {
      revenue_today: sum(ordersToday),
      revenue_7d: sum(orders7),
      revenue_30d: sum(orders30),
      orders_today: ordersToday.length,
      orders_7d: orders7.length,
      orders_30d: orders30.length,
      aov_30d: orders30.length ? sum(orders30) / orders30.length : 0,
      customers_total: stats.totalUsers ?? 0,
      products_total: stats.totalProducts ?? 0,
      reviews_pending: 0,
      questions_pending: 0,
      searches_7d: 0,
    },
    revenue_series: Array.from(dayMap.values()),
    orders_by_status,
    top_products: [],
    low_stock: [],
  };
}

// ─── Orders ────────────────────────────────────────────────────────────────

export async function adminListOrders(): Promise<any[]> {
  const data = await api.get<{ success: boolean; orders: any[]; shippingMap: Record<string, any> }>("/orders");
  const shippingMap: Record<string, any> = data.shippingMap ?? {};
  return (data.orders ?? []).map((o: any) => {
    const shipping = shippingMap[String(o._id)] ?? {};
    return {
      id: o._id,
      order_number: `KFY-${String(o._id).slice(-6).toUpperCase()}`,
      contact_name: shipping.name ?? o.user?.name ?? "",
      contact_phone: shipping.phoneNumber ?? "",
      address: shipping.address ?? "",
      city: shipping.courierCity ?? "",
      latitude: shipping.latitude ?? null,
      longitude: shipping.longitude ?? null,
      province: "",
      total: o.totalAmount,
      status: o.status,
      payment_method: shipping.shipping ?? "cod",
      created_at: o.createdAt,
      // Include raw data for expanded detail view
      _raw: {
        items: (o.items ?? []).map((item: any) => ({
          name: item.name ?? item.product?.name ?? "",
          quantity: item.quantity ?? item.qty ?? 1,
          price: item.price ?? item.product?.retailPrice ?? 0,
        })),
        shippingDetail: shipping,
      },
    };
  });
}

export async function adminUpdateOrderStatus(
  id: string,
  status: string,
): Promise<{ ok: boolean }> {
  await api.patch(`/orders/${id}/status`, { status });
  return { ok: true };
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function adminListProducts(): Promise<any[]> {
  const data = await api.get<{ success: boolean; products: any[] }>(
    "/products/admin-list?limit=1000",
  );
  return (data.products ?? []).map(normalizeProduct);
}

export async function adminUpsertProduct(input: any): Promise<{ ok: boolean }> {
  if (input.id) {
    await api.put(`/products/${input.id}`, input);
  }
  return { ok: true };
}

export async function adminDeleteProduct(id: string): Promise<{ ok: boolean }> {
  await api.del(`/products/${id}`);
  return { ok: true };
}

export async function adminGetDeletedProducts(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/products/deleted${qs ? `?${qs}` : ""}`);
}

export async function adminRestoreProduct(id: string): Promise<any> {
  return api.patch<any>(`/products/${id}/restore`);
}

// ─── Reviews ───────────────────────────────────────────────────────────────

export async function adminListReviews(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/reviews/admin${qs ? `?${qs}` : ""}`);
}

export async function adminDeleteReviewById(id: string): Promise<{ ok: boolean }> {
  await api.del(`/reviews/${id}`);
  return { ok: true };
}

export async function adminUpdateReviewById(id: string, payload: any): Promise<any> {
  return api.put<any>(`/reviews/${id}`, payload);
}

export async function adminToggleReviewPin(id: string): Promise<any> {
  return api.patch<any>(`/reviews/${id}/pin`, {});
}



// ─── Check admin ───────────────────────────────────────────────────────────

export async function isAdmin(): Promise<{ isAdmin: boolean }> {
  try {
    const data = await api.get<{ success: boolean; user: any }>("/auth/me");
    return { isAdmin: data.user?.role === "admin" };
  } catch {
    return { isAdmin: false };
  }
}

// ─── Users ─────────────────────────────────────────────────────────────────

export async function adminListUsers(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export async function adminGetUserById(userId: string): Promise<any> {
  return api.get<any>(`/admin/users/${userId}`);
}

export async function adminGetLoginHistory(userId: string): Promise<any> {
  return api.get<any>(`/admin/users/${userId}/login-history`);
}

export async function adminGetUserActivity(userId: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/admin/users/${userId}/activity${qs ? `?${qs}` : ""}`);
}

export async function adminDeleteUser(userId: string, message = ""): Promise<any> {
  return api.del<any>(`/admin/users/${userId}`);
}

export async function adminBlockUser(userId: string, message = ""): Promise<any> {
  return api.post<any>(`/admin/users/${userId}/block`, { message });
}

export async function adminUnblockUser(blockedId: string): Promise<any> {
  return api.post<any>(`/admin/users/${blockedId}/unblock`);
}

export async function adminUpdateUserProfile(userId: string, data: any): Promise<any> {
  return api.put<any>(`/admin/users/${userId}/profile`, data);
}

export async function adminGetUserTimeStats(userId: string): Promise<any> {
  return api.get<any>(`/admin/users/${userId}/time-stats`);
}

export async function adminSetUserTier(userId: string, tier: string): Promise<any> {
  return api.patch<any>(`/admin/users/${userId}/tier`, { tier });
}

export async function adminSetUserDiscount(userId: string, percent: number): Promise<any> {
  return api.patch<any>(`/admin/users/${userId}/discount`, { percent });
}

export async function adminResetUserTier(userId: string): Promise<any> {
  return api.post<any>(`/admin/users/${userId}/reset-tier`);
}

export async function adminSetUserLoyaltyPoints(userId: string, points: number, reason?: string): Promise<any> {
  return api.patch<any>(`/admin/users/${userId}/loyalty-points`, { points, reason });
}

// ─── Activity Logs ─────────────────────────────────────────────────────────

export async function adminGetActivityLogs(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/admin/activity-logs${qs ? `?${qs}` : ""}`);
}

// ─── Website Reviews ───────────────────────────────────────────────────────

export async function adminGetWebsiteReviews(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/website-reviews${qs ? `?${qs}` : ""}`);
}

export async function adminUpdateWebsiteReview(id: string, payload: any): Promise<any> {
  return api.put<any>(`/website-reviews/${id}`, payload);
}

export async function adminDeleteWebsiteReview(id: string): Promise<any> {
  return api.del<any>(`/website-reviews/${id}`);
}

export async function adminToggleWebsiteReviewPin(id: string): Promise<any> {
  return api.patch<any>(`/website-reviews/${id}/pin`, {});
}

// ─── User Final Data ───────────────────────────────────────────────────────

export async function adminGetUserFinalData(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/admin/users-final-data${qs ? `?${qs}` : ""}`);
}

export async function adminGenerateUserFinalData(): Promise<any> {
  return api.post<any>("/admin/users-final-data/generate", {});
}

// ─── Price Diagnostics ─────────────────────────────────────────────────────

export async function adminGetLatestDiagnostic(): Promise<any> {
  return api.get<any>("/admin/diagnostic/latest");
}

export async function adminRunDiagnostic(): Promise<any> {
  return api.post<any>("/admin/diagnostic/price", {});
}

export async function adminSetDiagnosticPrice(diagnosticId: string, productId: string, retailPrice: number): Promise<any> {
  return api.post<any>("/admin/diagnostic/price/set", { diagnosticId, productId, retailPrice });
}

export async function adminResolveDiagnostic(diagnosticId: string): Promise<any> {
  return api.post<any>("/admin/diagnostic/resolve", { diagnosticId });
}

// ─── Price Ranges ──────────────────────────────────────────────────────────

export async function adminGetPriceRanges(): Promise<any> {
  return api.get<any>("/admin/price-ranges");
}

export async function adminCreatePriceRange(data: { minPrice: number; maxPrice: number; profitMargin: number }): Promise<any> {
  return api.post<any>("/admin/price-ranges", data);
}

export async function adminDeletePriceRange(id: string): Promise<any> {
  return api.del<any>(`/admin/price-ranges/${id}`);
}

export async function adminGetPriceRangeProducts(id: string): Promise<any> {
  return api.get<any>(`/admin/price-ranges/${id}/products`);
}

// ─── Pre-Orders ────────────────────────────────────────────────────────────

export async function adminGetPreOrders(): Promise<any[]> {
  const data = await api.get<{ success: boolean; preOrders: any[] }>("/orders/preorders");
  return (data.preOrders ?? []).map((o: any) => ({
    id: o._id,
    order_number: `KFY-${String(o.order ?? o._id).slice(-6).toUpperCase()}`,
    contact_name: o.name ?? o.user?.name ?? "",
    contact_phone: o.phoneNumber ?? "",
    address: o.address ?? "",
    city: o.courierCity ?? "",
    total: o.sellPrice ?? o.totalAmount ?? 0,
    status: o.status,
    payment_method: o.shipping ?? "cod",
    courier: o.courierCompany ?? "",
    created_at: o.createdAt,
    email: o.email ?? "",
    finalized: o.finalized ?? false,
    items: (o.items ?? []).map((item: any) => ({
      name: item.name ?? item.product?.name ?? "",
      quantity: item.quantity ?? 1,
      price: item.price ?? item.product?.retailPrice ?? 0,
    })),
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
  }));
}

// ─── CSV Export ────────────────────────────────────────────────────────────

export async function adminGetCSVQueueCount(): Promise<number> {
  const data = await api.get<{ success: boolean; count: number }>("/admin/export-csv/count");
  return data.count ?? 0;
}

export async function adminDownloadCSV(courierCity = ""): Promise<void> {
  const qs = courierCity ? `?courierCity=${encodeURIComponent(courierCity)}` : "";
  const response = await fetch(`/api/admin/export-csv${qs}`, { credentials: "include" });
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    // Surface both error AND empty-queue responses as thrown errors so callers
    // can show the right toast instead of silently doing nothing.
    throw new Error(data.message || (response.ok ? "No orders queued for export." : "CSV export failed."));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as any).message || "CSV export failed");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `hhc-bulk-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function adminDownloadPreOrderCSV(courierCity = ""): Promise<void> {
  const qs = courierCity ? `?courierCity=${encodeURIComponent(courierCity)}` : "";
  const response = await fetch(`/api/admin/export-csv/preorders${qs}`, { credentials: "include" });
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    throw new Error(data.message || (response.ok ? "No pre-orders found to export." : "Pre-order CSV export failed."));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as any).message || "Pre-order CSV export failed");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `pre-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function adminMovePreOrderToCSV(preOrderId: string): Promise<any> {
  return api.post<any>(`/admin/export-csv/move-preorder/${preOrderId}`, {});
}

export async function adminListProductsPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<{ products: any[]; total: number; page: number; totalPages: number }> {
  const { page = 1, limit = 50, search = "" } = params;
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (search) qs.set("search", search);
  const data = await api.get<{ success: boolean; products: any[]; total: number; page: number }>(
    `/products/admin-list?${qs.toString()}`,
  );
  const products = (data.products ?? []).map(normalizeProduct);
  const total = data.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;
  return { products, total, page: data.page ?? page, totalPages };
}

// ─── HHC Proxy ─────────────────────────────────────────────────────────────

export async function hhcTestToken(token: string): Promise<any> {
  return api.post<any>("/hhc-proxy/test-token", { token });
}

export async function hhcQuickFetch(token: string): Promise<any> {
  return api.post<any>("/hhc-proxy/quick-fetch", { token });
}

export async function hhcSyncAll(token: string, totalPages = 211): Promise<any> {
  return api.post<any>("/hhc-proxy/sync-all", { token, totalPages });
}

export async function hhcGetSyncStatus(): Promise<any> {
  return api.get<any>("/hhc-proxy/sync-status");
}

export async function hhcStopSync(): Promise<any> {
  return api.post<any>("/hhc-proxy/sync-stop", {});
}

export async function hhcGetSavedToken(): Promise<any> {
  return api.get<any>("/hhc-proxy/token");
}

export async function adminFetchProductDynamicData(productId: string): Promise<any> {
  return api.post<any>(`/hhc-proxy/product-dynamic-data/${productId}`, {});
}

export async function hhcSyncDynamicAll(token?: string): Promise<any> {
  return api.post<any>("/hhc-proxy/sync-dynamic-all", token ? { token } : {});
}

export async function hhcGetDynamicSyncStatus(): Promise<any> {
  return api.get<any>("/hhc-proxy/sync-dynamic-status");
}

export async function hhcStopDynamicSync(): Promise<any> {
  return api.post<any>("/hhc-proxy/sync-dynamic-stop", {});
}

export async function recategorizeProducts(): Promise<any> {
  return api.post<any>("/products/recategorize-all", {});
}

export async function getRecategorizeStatus(): Promise<any> {
  return api.get<any>("/products/recategorize-status");
}

// ─── Products (extended) ───────────────────────────────────────────────────

export async function adminGetProductStats(): Promise<any> {
  return api.get<any>("/products/stats");
}

export async function adminGetLeaderboard(): Promise<any> {
  return api.get<any>("/products/leaderboard");
}

export async function adminGetCategoryPricing(): Promise<any> {
  return api.get<any>("/products/category-pricing");
}

export async function adminUpdatePricingAll(percentage: number): Promise<any> {
  return api.post<any>("/products/update-pricing-all", { percentage });
}

export async function adminUpdatePricingByCategory(category: string, percentage: number): Promise<any> {
  return api.post<any>("/products/update-pricing-by-category", { category, percentage });
}

export async function adminGetOutOfStock(): Promise<any> {
  return api.get<any>("/products/out-of-stock");
}

export async function adminClearProducts(): Promise<any> {
  return api.del<any>("/products");
}

export async function adminUploadProductCSV(formData: FormData): Promise<any> {
  const response = await fetch(BASE + "/products/upload-csv", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).message || "Upload failed");
  return data;
}

export async function adminUploadProductFiles(formData: FormData): Promise<any> {
  const response = await fetch(BASE + "/products/upload-files", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).message || "Upload failed");
  return data;
}

export async function adminUpdateProduct(id: string, payload: any): Promise<any> {
  return api.put<any>(`/products/${id}`, payload);
}

export async function adminUpdateProductManualPosition(id: string, position: number): Promise<any> {
  return api.patch<any>(`/products/${id}/manual-position`, { position });
}

export async function adminUpdateBulkManualPositions(updates: { productId: string; position: number }[]): Promise<any> {
  return api.put<any>(`/products/manual-positions/bulk`, { updates });
}

export async function adminClearAllManualPositions(): Promise<any> {
  return api.del<any>(`/products/manual-positions`);
}

export async function adminGetProductOrders(productId: string): Promise<any> {
  return api.get<any>(`/products/${productId}/orders`);
}

export async function adminToggleFeaturedOnLanding(id: string, featured: boolean): Promise<any> {
  const response = await fetch(`/api/products/${id}/featured-landing`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featured }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).message || "Failed to toggle featured status");
  return data;
}

export async function adminGetFeaturedLandingProducts(): Promise<any[]> {
  const data = await api.get<{ success: boolean; products: any[] }>("/products/featured-landing?limit=50");
  return data.products ?? [];
}

// Featured order editor — raw products kept light (no normalizeProduct, which
// would drop featuredOrder) so the admin can reorder them.
export async function adminGetFeaturedLandingOrdered(): Promise<
  { _id: string; name: string; imageUrl: string | null; featuredOrder: number | null }[]
> {
  const data = await api.get<{ success: boolean; products: any[] }>("/products/featured-landing?limit=80");
  return (data.products ?? []).map((p: any) => ({
    _id: p._id ?? p.id ?? "",
    name: p.name ?? "",
    imageUrl: p.imageUrl ?? null,
    featuredOrder: typeof p.featuredOrder === "number" ? p.featuredOrder : null,
  }));
}

export async function adminSaveFeaturedOrder(order: string[]): Promise<any> {
  return api.put<any>("/products/featured-order", { order });
}

export async function adminGetFeaturedCount(): Promise<number> {
  const data = await api.get<{ success: boolean; count: number }>("/products/featured-count");
  return data.count ?? 0;
}

// Product Hunting — search existing products (name + category), each result
// carries its own featuredOnLanding flag so the page can show "Added" state.
export async function adminHuntProducts(params: {
  search?: string;
  category?: string;
  limit?: number;
} = {}): Promise<{ products: any[]; total: number }> {
  const { search = "", category = "", limit = 60 } = params;
  const qs = new URLSearchParams();
  if (search.trim()) qs.set("search", search.trim());
  if (category) qs.set("category", category);
  qs.set("limit", String(limit));
  const data = await api.get<{ success: boolean; products: any[]; total: number }>(
    `/products?${qs.toString()}`,
  );
  return { products: (data.products ?? []).map(normalizeProduct), total: data.total ?? 0 };
}

// Product Hunting — manually add a product that goes straight to the main page
export async function adminCreateProduct(input: {
  name: string;
  wholesalePrice: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  stock?: number;
  weight?: number;
  featuredOnLanding?: boolean;
}): Promise<any> {
  return api.post<any>("/products/manual", input);
}

// ─── AI Automations ───────────────────────────────────────────────────────

export async function aiStartDescriptionDoctor(): Promise<any> {
  return api.post<any>("/admin/ai/description-doctor/start", {});
}
export async function aiGetDescriptionDoctorStatus(): Promise<any> {
  return api.get<any>("/admin/ai/description-doctor/status");
}

export async function aiStartTitleOptimizer(): Promise<any> {
  return api.post<any>("/admin/ai/title-optimizer/start", {});
}
export async function aiGetTitleOptimizerStatus(): Promise<any> {
  return api.get<any>("/admin/ai/title-optimizer/status");
}

export async function aiAnalyzeReviews(): Promise<any> {
  return api.post<any>("/admin/ai/review-intelligence", {});
}

export async function aiFindDuplicates(): Promise<any> {
  return api.post<any>("/admin/ai/duplicate-radar", {});
}

export async function aiHideProduct(id: string): Promise<any> {
  const response = await fetch(`/api/admin/ai/products/${id}/hide`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).message || "Failed");
  return data;
}

export async function aiGetPoolStatus(): Promise<any> {
  return api.get<any>("/admin/ai/pool-status");
}

// ─── Settings — multi-key Groq management ─────────────────────────────────

export async function adminGetSettings(): Promise<any> {
  return api.get<any>("/admin/settings");
}

// Storefront delivery fee — exposed publicly via /settings/public, editable here
export async function adminUpdateDeliveryFee(deliveryFee: number): Promise<any> {
  return api.put<any>("/admin/settings/delivery-fee", { deliveryFee });
}

// Landing hero diptych ("Objects Considered") — left/right product ids
export async function adminSetHeroObjects(hero: { left: string | null; right: string | null }): Promise<any> {
  return api.put<any>("/admin/settings/hero-objects", hero);
}

// Multi-key endpoints
export async function adminAddGroqKey(payload: { key: string; label: string; task: string }): Promise<any> {
  return api.post<any>("/admin/settings/groq-keys", payload);
}
export async function adminUpdateGroqKey(id: string, payload: { label?: string; task?: string }): Promise<any> {
  return api.put<any>(`/admin/settings/groq-keys/${id}`, payload);
}
export async function adminDeleteGroqKeyById(id: string): Promise<any> {
  return api.del<any>(`/admin/settings/groq-keys/${id}`);
}
export async function adminTestGroqKeyById(id: string): Promise<any> {
  return api.post<any>(`/admin/settings/groq-keys/${id}/test`, {});
}

// Legacy (kept for compat)
export async function adminSaveGroqKey(key: string): Promise<any> {
  return api.put<any>("/admin/settings/groq-key", { key });
}
export async function adminDeleteGroqKey(): Promise<any> {
  return api.del<any>("/admin/settings/groq-key");
}
export async function adminTestGroqKey(key?: string): Promise<any> {
  return api.post<any>("/admin/settings/groq-key/test", { key: key ?? "" });
}

// ─── AI Studio — new automations ──────────────────────────────────────────

export async function aiStartSeoBooster(): Promise<any> {
  return api.post<any>("/admin/ai/seo-booster/start", {});
}
export async function aiGetSeoBoosterStatus(): Promise<any> {
  return api.get<any>("/admin/ai/seo-booster/status");
}

export async function aiAnalyzePricing(): Promise<any> {
  return api.post<any>("/admin/ai/price-intelligence", {});
}

export async function aiStartCategoryFixer(): Promise<any> {
  return api.post<any>("/admin/ai/category-fixer/start", {});
}
export async function aiGetCategoryFixerStatus(): Promise<any> {
  return api.get<any>("/admin/ai/category-fixer/status");
}

// ─── Order Status Management (main order tracking) ──────────────────────────
// Sourced from the OrderHistory archive — written when the admin downloads
// the main order CSV — so pending confirmations / pre-orders never appear.

export async function adminListTrackedOrders(params: {
  page?: number;
  limit?: number;
} = {}): Promise<{ orders: any[]; pagination: any }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return api.get<any>(`/admin/order-status${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function adminUpdateTrackedOrderStatus(
  id: string,
  status: string,
): Promise<{ ok: boolean }> {
  await api.patch(`/admin/order-status/${id}`, { status });
  return { ok: true };
}

// ─── Orders (extended) ────────────────────────────────────────────────────

export async function adminFinalizeOrder(orderId: string): Promise<any> {
  return api.post<any>(`/orders/finalize/${orderId}`, {});
}

// ─── Low stock orders (workflow) ──────────────────────────────────────────

export async function adminGetLowStockOrders(): Promise<any> {
  return api.get<any>("/workflow/low-stock-orders");
}

export async function adminRemoveLowStockOrder(orderId: string, reason?: string): Promise<any> {
  return api.post<any>(`/workflow/remove-low-stock/${orderId}`, { reason });
}

// ─── Defective Product Reports ────────────────────────────────────────────────

export async function adminGetDefectiveReports(params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return api.get<any>(`/defective-products${qs ? `?${qs}` : ""}`);
}

export async function adminGetDefectiveReportById(id: string): Promise<any> {
  return api.get<any>(`/defective-products/${id}`);
}

export async function adminUpdateDefectiveReportStatus(id: string, payload: { status: string; adminNote?: string }): Promise<any> {
  return api.patch<any>(`/defective-products/${id}`, payload);
}
