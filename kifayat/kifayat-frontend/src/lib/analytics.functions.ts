/**
 * Heavy analytics data layer — fetches from existing API endpoints only.
 * Isolated from all other admin functions to avoid touching fragile features.
 */
import { api } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevPoint   { date: string; revenue: number; orders: number; aov: number }
export interface StatusPoint { status: string; count: number; revenue: number }
export interface PayPoint    { method: string; count: number; revenue: number }
export interface CityPoint   { city: string; orders: number; revenue: number; aov: number }
export interface HourPoint   { hour: number; label: string; orders: number }
export interface WeekPoint   { day: string; short: string; orders: number; revenue: number }
export interface ProdRevPoint { id: string; name: string; imageUrl: string | null; category: string; units: number; revenue: number; aov: number }
export interface CatPoint    { category: string; units: number; revenue: number; orders: number }
export interface BucketPoint { label: string; min: number; max: number; count: number }
export interface RepeatPoint { type: "New" | "Returning"; count: number }
export interface RecentOrder { id: string; ref: string; city: string; total: number; status: string; method: string; createdAt: string; itemCount: number }

export type TimeRange = "7d" | "30d" | "90d";

export interface KpiBlock {
  revenue_30d: number; revenue_prev_30d: number
  orders_30d: number;  orders_prev_30d: number
  aov_30d: number
  revenue_today: number; orders_today: number
  customers_total: number; products_total: number
  pending_orders: number
}

export interface AnalyticsData {
  kpi: KpiBlock
  series7d: RevPoint[]; series30d: RevPoint[]; series90d: RevPoint[]
  ordersByStatus: StatusPoint[]
  paymentSplit: PayPoint[]
  cities: CityPoint[]
  hourly: HourPoint[]
  weekday: WeekPoint[]
  topByRevenue: ProdRevPoint[]
  categories: CatPoint[]
  valueBuckets: BucketPoint[]
  repeatRate: RepeatPoint[]
  recentOrders: RecentOrder[]
  generatedAt: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSeries(orders: any[], days: number): RevPoint[] {
  const now   = new Date();
  const map   = new Map<string, RevPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    map.set(k, { date: k, revenue: 0, orders: 0, aov: 0 });
  }
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  orders
    .filter(o => new Date(o.createdAt) >= cutoff)
    .forEach(o => {
      const k = (o.createdAt ?? "").slice(0, 10);
      if (map.has(k)) {
        const e = map.get(k)!;
        e.revenue += Number(o.totalAmount ?? 0);
        e.orders  += 1;
      }
    });
  return Array.from(map.values()).map(e => ({
    ...e,
    aov: e.orders > 0 ? e.revenue / e.orders : 0,
  }));
}

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Main fetcher ─────────────────────────────────────────────────────────────

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const [ordersRes, statsRes, leaderboardRes] = await Promise.all([
    api.get<{ orders: any[]; shippingMap: Record<string, any> }>("/orders"),
    api.get<{ success: boolean; totalProducts: number; totalUsers: number; outOfStock: number; inStock: number; categories: number; topSold: any }>("/products/stats"),
    api.get<{ products: any[] }>("/products/leaderboard?limit=200"),
  ]);

  const orders      = ordersRes.orders ?? [];
  const shippingMap = ordersRes.shippingMap ?? {};
  const stats       = statsRes;
  const leaderboard = leaderboardRes.products ?? [];

  const now        = new Date();
  const startToday = new Date(now); startToday.setHours(0,0,0,0);
  const since30    = new Date(now.getTime() - 30  * 86_400_000);
  const since60    = new Date(now.getTime() - 60  * 86_400_000);

  const o30     = orders.filter(o => new Date(o.createdAt) >= since30);
  const oPrev30 = orders.filter(o => {
    const d = new Date(o.createdAt);
    return d >= since60 && d < since30;
  });
  const oToday = orders.filter(o => new Date(o.createdAt) >= startToday);

  const sum = (arr: any[]) => arr.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

  // ── KPI ────────────────────────────────────────────────────────────────────
  const kpi: KpiBlock = {
    revenue_30d:      sum(o30),
    revenue_prev_30d: sum(oPrev30),
    orders_30d:       o30.length,
    orders_prev_30d:  oPrev30.length,
    aov_30d:          o30.length ? sum(o30) / o30.length : 0,
    revenue_today:    sum(oToday),
    orders_today:     oToday.length,
    customers_total:  stats.totalUsers    ?? 0,
    products_total:   stats.totalProducts ?? 0,
    pending_orders:   orders.filter(o => o.status === "pending" || o.status === "processing").length,
  };

  // ── Revenue series ─────────────────────────────────────────────────────────
  const series7d  = buildSeries(orders, 7);
  const series30d = buildSeries(orders, 30);
  const series90d = buildSeries(orders, 90);

  // ── Orders by status (all time) ────────────────────────────────────────────
  const statusMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach(o => {
    const s = o.status ?? "unknown";
    const e = statusMap.get(s) ?? { count: 0, revenue: 0 };
    e.count   += 1;
    e.revenue += Number(o.totalAmount ?? 0);
    statusMap.set(s, e);
  });
  const ordersByStatus: StatusPoint[] = Array.from(statusMap.entries())
    .map(([status, e]) => ({ status, ...e }))
    .sort((a, b) => b.count - a.count);

  // ── Payment method split (last 30d) ────────────────────────────────────────
  const payMap = new Map<string, { count: number; revenue: number }>();
  o30.forEach(o => {
    const sd  = shippingMap[String(o._id)] ?? {};
    const raw = (sd.shipping ?? "cod").toString().toLowerCase();
    const method = raw === "cod" ? "COD" : "Prepaid";
    const e   = payMap.get(method) ?? { count: 0, revenue: 0 };
    e.count   += 1;
    e.revenue += Number(o.totalAmount ?? 0);
    payMap.set(method, e);
  });
  const paymentSplit: PayPoint[] = Array.from(payMap.entries())
    .map(([method, e]) => ({ method, ...e }))
    .sort((a, b) => b.count - a.count);

  // ── City stats (all time) ──────────────────────────────────────────────────
  const cityMap = new Map<string, { orders: number; revenue: number }>();
  orders.forEach(o => {
    const sd   = shippingMap[String(o._id)] ?? {};
    const city = (sd.courierCity ?? "Unknown").trim() || "Unknown";
    const e    = cityMap.get(city) ?? { orders: 0, revenue: 0 };
    e.orders  += 1;
    e.revenue += Number(o.totalAmount ?? 0);
    cityMap.set(city, e);
  });
  const cities: CityPoint[] = Array.from(cityMap.entries())
    .map(([city, e]) => ({ city, ...e, aov: e.orders > 0 ? e.revenue / e.orders : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Hourly pattern (all time) ─────────────────────────────────────────────
  const hourMap = new Array(24).fill(0);
  orders.forEach(o => {
    const h = new Date(o.createdAt).getHours();
    hourMap[h] = (hourMap[h] ?? 0) + 1;
  });
  const hourly: HourPoint[] = hourMap.map((count, hour) => ({
    hour,
    label: hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`,
    orders: count,
  }));

  // ── Day of week pattern (all time) ────────────────────────────────────────
  const weekMap = new Array(7).fill(null).map(() => ({ orders: 0, revenue: 0 }));
  orders.forEach(o => {
    const d = new Date(o.createdAt).getDay();
    weekMap[d].orders  += 1;
    weekMap[d].revenue += Number(o.totalAmount ?? 0);
  });
  const weekday: WeekPoint[] = weekMap.map((e, i) => ({
    day:     DAYS[i],
    short:   SHORT[i],
    orders:  e.orders,
    revenue: e.revenue,
  }));

  // ── Top products by revenue (derived from order items) ───────────────────
  const prodMap = new Map<string, { name: string; imageUrl: string | null; category: string; units: number; revenue: number }>();
  orders.forEach(o => {
    (o.items ?? []).forEach((item: any) => {
      const prod = item.product ?? {};
      const id   = String(prod._id ?? item.product ?? "unknown");
      const name = item.name ?? prod.name ?? "Unknown";
      const qty  = Number(item.quantity ?? 1);
      const price= Number(item.price ?? prod.retailPrice ?? 0);
      const rev  = qty * price;
      const e    = prodMap.get(id) ?? { name, imageUrl: prod.imageUrl ?? null, category: prod.category ?? "", units: 0, revenue: 0 };
      e.units   += qty;
      e.revenue += rev;
      prodMap.set(id, e);
    });
  });
  // Also merge leaderboard data for products not yet in orders
  leaderboard.forEach((p: any) => {
    const id = String(p._id);
    if (!prodMap.has(id)) {
      prodMap.set(id, {
        name:     p.name,
        imageUrl: p.imageUrl ?? null,
        category: p.category ?? "",
        units:    p.salesCount ?? 0,
        revenue:  (p.salesCount ?? 0) * (p.retailPrice ?? 0),
      });
    }
  });
  const topByRevenue: ProdRevPoint[] = Array.from(prodMap.entries())
    .map(([id, e]) => ({ id, ...e, aov: e.units > 0 ? e.revenue / e.units : 0 }))
    .filter(p => p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Category stats ────────────────────────────────────────────────────────
  const catMap = new Map<string, { units: number; revenue: number; orders: number }>();
  orders.forEach(o => {
    const cats = new Set<string>();
    (o.items ?? []).forEach((item: any) => {
      const cat = (item.product?.category ?? item.category ?? "Other").trim() || "Other";
      const qty  = Number(item.quantity ?? 1);
      const rev  = qty * Number(item.price ?? item.product?.retailPrice ?? 0);
      const e    = catMap.get(cat) ?? { units: 0, revenue: 0, orders: 0 };
      e.units   += qty;
      e.revenue += rev;
      catMap.set(cat, e);
      cats.add(cat);
    });
    cats.forEach(cat => {
      const e = catMap.get(cat)!;
      e.orders += 1;
      catMap.set(cat, e);
    });
  });
  const categories: CatPoint[] = Array.from(catMap.entries())
    .map(([category, e]) => ({ category, ...e }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // ── Order value distribution ──────────────────────────────────────────────
  const BUCKETS = [
    { label: "< 500",     min: 0,     max: 500   },
    { label: "500–1k",    min: 500,   max: 1000  },
    { label: "1k–2k",     min: 1000,  max: 2000  },
    { label: "2k–5k",     min: 2000,  max: 5000  },
    { label: "5k–10k",    min: 5000,  max: 10000 },
    { label: "> 10k",     min: 10000, max: Infinity },
  ];
  const valueBuckets: BucketPoint[] = BUCKETS.map(b => ({
    ...b,
    count: orders.filter(o => {
      const v = Number(o.totalAmount ?? 0);
      return v >= b.min && v < b.max;
    }).length,
  }));

  // ── Customer repeat rate ──────────────────────────────────────────────────
  const userOrderCount = new Map<string, number>();
  orders.forEach(o => {
    const uid = String(o.user?._id ?? o.user ?? "guest");
    userOrderCount.set(uid, (userOrderCount.get(uid) ?? 0) + 1);
  });
  let newCount = 0, returnCount = 0;
  userOrderCount.forEach(count => {
    if (count === 1) newCount++;
    else returnCount++;
  });
  const repeatRate: RepeatPoint[] = [
    { type: "New",       count: newCount    },
    { type: "Returning", count: returnCount },
  ];

  // ── Recent orders ─────────────────────────────────────────────────────────
  const recentOrders: RecentOrder[] = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15)
    .map(o => {
      const sd = shippingMap[String(o._id)] ?? {};
      return {
        id:        String(o._id),
        ref:       `KFY-${String(o._id).slice(-6).toUpperCase()}`,
        city:      sd.courierCity ?? "—",
        total:     Number(o.totalAmount ?? 0),
        status:    o.status ?? "unknown",
        method:    (sd.shipping ?? "cod").toLowerCase() === "cod" ? "COD" : "Prepaid",
        createdAt: o.createdAt ?? "",
        itemCount: (o.items ?? []).length,
      };
    });

  return {
    kpi, series7d, series30d, series90d,
    ordersByStatus, paymentSplit, cities,
    hourly, weekday, topByRevenue, categories,
    valueBuckets, repeatRate, recentOrders,
    generatedAt: Date.now(),
  };
}
