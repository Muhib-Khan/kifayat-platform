import { api, normalizeProduct, BASE } from "./api";

export type SellerProductInput = {
  name: string;
  description?: string;
  retailPrice: number;
  stock?: number;
  category?: string;
  weight?: number;
  imageUrl?: string;
  videoUrl?: string;
  sku?: string;
};

export type SellerAnalytics = {
  generatedAt: number;
  account: SellerAccount;
  health: {
    score: number;
    label: string;
    signals: { tone: "critical" | "warning" | "positive"; title: string; detail: string }[];
  };
  kpi: {
    productsTotal: number;
    activeProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    inventoryValue: number;
    totalUnitsSold: number;
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
    revenue30d: number;
    orders30d: number;
  };
  periods: Record<"last7" | "last30" | "last90" | "allTime", { revenue: number; orders: number; units: number }>;
  catalog: {
    activeProducts: number;
    hiddenProducts: number;
    deletedProducts: number;
    withImages: number;
    withDescriptions: number;
    withSales: number;
    totalStockUnits: number;
    averageProductPrice: number;
    listingCompleteness: number;
    categories: {
      category: string;
      products: number;
      activeProducts: number;
      stockUnits: number;
      unitsSold: number;
      orders: number;
      revenue: number;
      outOfStock: number;
      averageOrderValue: number;
    }[];
  };
  fulfillment: {
    deliveryRate: number;
    cancellationRate: number;
    pendingRate: number;
    deliveredRevenue: number;
    cancelledRevenue: number;
  };
  series: { date: string; revenue: number; orders: number; units: number }[];
  statuses: { status: string; orders: number; revenue: number }[];
  products: {
    id: string; name: string; sku: string; category: string; price: number; stock: number;
    salesCount: number; hidden: boolean; deleted: boolean; unitsSold: number; revenue: number;
    orders: number; lastSoldAt: string | null; imageUrl: string;
  }[];
  recentOrders: {
    id: string; date: string; status: string; source: string; city: string; units: number; revenue: number;
  }[];
};

export type SellerAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  storeSlug: string;
  role: string;
  authProvider: string;
  isVerified: boolean;
  orderConfirmationEmail: string;
  orderConfirmationEmailVerified: boolean;
  shipmentEmailsCount: number;
  createdAt: string | null;
  lastActiveAt: string | null;
  joinedDaysAgo: number | null;
  inactiveDays: number | null;
  accountStatus: "active" | "dormant" | "inactive";
};

function normalizeSellerAccount(account: any = {}, seller: any = {}): SellerAccount {
  return {
    id: "",
    name: "",
    email: "",
    phone: "",
    storeName: "Seller store",
    storeSlug: "faizs-store",
    role: "seller",
    authProvider: "email",
    isVerified: false,
    orderConfirmationEmail: "",
    orderConfirmationEmailVerified: false,
    shipmentEmailsCount: 0,
    createdAt: null,
    lastActiveAt: null,
    joinedDaysAgo: null,
    inactiveDays: null,
    accountStatus: "active",
    ...account,
    ...seller,
  };
}

function normalizeSellerAnalytics(raw: any = {}, seller: any = {}): SellerAnalytics {
  const kpi = {
    productsTotal: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    inventoryValue: 0,
    totalUnitsSold: 0,
    totalRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    revenue30d: 0,
    orders30d: 0,
    ...(raw.kpi || {}),
  };
  const periods = raw.periods || {
    last7: { revenue: 0, orders: 0, units: 0 },
    last30: { revenue: kpi.revenue30d, orders: kpi.orders30d, units: 0 },
    last90: { revenue: kpi.revenue30d, orders: kpi.orders30d, units: 0 },
    allTime: { revenue: kpi.totalRevenue, orders: kpi.totalOrders, units: kpi.totalUnitsSold },
  };
  const products = Array.isArray(raw.products) ? raw.products : [];
  return {
    generatedAt: raw.generatedAt || Date.now(),
    account: normalizeSellerAccount(raw.account, seller),
    health: raw.health || {
      score: 0,
      label: "Not enough data",
      signals: [{ tone: "warning", title: "Detailed health scoring is pending", detail: "Refresh after the seller analytics service finishes updating." }],
    },
    kpi,
    periods,
    catalog: raw.catalog || {
      activeProducts: kpi.activeProducts,
      hiddenProducts: 0,
      deletedProducts: 0,
      withImages: 0,
      withDescriptions: 0,
      withSales: products.filter((product: any) => Number(product.unitsSold) > 0).length,
      totalStockUnits: products.reduce((sum: number, product: any) => sum + Number(product.stock || 0), 0),
      averageProductPrice: 0,
      listingCompleteness: 0,
      categories: [],
    },
    fulfillment: raw.fulfillment || {
      deliveryRate: kpi.totalOrders ? (kpi.deliveredOrders / kpi.totalOrders) * 100 : 0,
      cancellationRate: kpi.totalOrders ? (kpi.cancelledOrders / kpi.totalOrders) * 100 : 0,
      pendingRate: kpi.totalOrders ? (kpi.pendingOrders / kpi.totalOrders) * 100 : 0,
      deliveredRevenue: 0,
      cancelledRevenue: 0,
    },
    series: Array.isArray(raw.series) ? raw.series : [],
    statuses: Array.isArray(raw.statuses) ? raw.statuses : [],
    products,
    recentOrders: Array.isArray(raw.recentOrders) ? raw.recentOrders : [],
  };
}

export async function sellerListProducts(): Promise<any[]> {
  const data = await api.get<{ success: boolean; products: any[] }>("/seller/products");
  return (data.products ?? []).map(normalizeProduct);
}

export async function sellerCreateProduct(input: SellerProductInput): Promise<any> {
  const data = await api.post<{ success: boolean; product: any }>("/seller/products", input);
  return normalizeProduct(data.product);
}

export async function sellerUpdateProduct(id: string, input: Partial<SellerProductInput>): Promise<any> {
  const data = await api.put<{ success: boolean; product: any }>(`/seller/products/${id}`, input);
  return normalizeProduct(data.product);
}

export async function sellerDeleteProduct(id: string): Promise<void> {
  await api.del(`/seller/products/${id}`);
}

export async function sellerUploadProductFiles(formData: FormData): Promise<any> {
  const response = await fetch(BASE + "/seller/upload-files", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).message || "Upload failed");
  return data;
}

export async function getSellerStore(slug = "faizs-store"): Promise<{ seller: any; products: any[] }> {
  const data = await api.get<{ success: boolean; seller: any; products: any[] }>(`/sellers/${slug}`);
  return { seller: data.seller, products: (data.products ?? []).map(normalizeProduct) };
}

export async function getSellerAnalytics(): Promise<{ seller: any; analytics: SellerAnalytics }> {
  const data = await api.get<{ success: boolean; seller: any; analytics: SellerAnalytics }>("/seller/analytics");
  return { seller: normalizeSellerAccount(data.seller, data.analytics?.account), analytics: normalizeSellerAnalytics(data.analytics, data.seller) };
}

export async function getSellerMonitoring(): Promise<{
  sellers: { seller: any; analytics: SellerAnalytics }[];
  generatedAt: number;
}> {
  const data = await api.get<{ sellers?: { seller: any; analytics: SellerAnalytics }[]; generatedAt?: number }>("/seller/monitoring");
  return {
    generatedAt: data.generatedAt || Date.now(),
    sellers: (data.sellers || []).map((row) => ({
      seller: normalizeSellerAccount(row.seller, row.analytics?.account),
      analytics: normalizeSellerAnalytics(row.analytics, row.seller),
    })),
  };
}