import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, BarChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, Package,
  ArrowUpRight, Clock, RefreshCw, MapPin, Zap, Award, BarChart2, Timer,
} from "lucide-react";
import { fetchAnalytics, type AnalyticsData, type TimeRange } from "@/lib/analytics.functions";
import { adminGetUserTimeStats } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-store";
import { getAdminRole } from "@/lib/admin-roles";
import { motion, type Variants } from "framer-motion";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

// ─── Palette & Config ─────────────────────────────────────────────────────────

export const GOLD     = "#c9a14a";
export const COAL     = "#1a1a1a";
export const BONE     = "#f5f1ea";
export const MUTED    = "#1a1a1a60";

export const STATUS_COLOR: Record<string, string> = {
  pending:    "#f59e0b",
  processing: "#3b82f6",
  confirmed:  "#8b5cf6",
  shipped:    "#6366f1",
  delivered:  "#10b981",
  cancelled:  "#ef4444",
  refunded:   "#ec4899",
  unknown:    "#9ca3af",
};

export const PIE_COLORS = [GOLD, COAL, "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function Panel({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={`admin-panel bg-card border border-border rounded-2xl p-5 sm:p-6 ${className}`}>
      <h3 className="font-sans font-semibold text-base tracking-tight mb-1">{title}</h3>
      {subtitle && <p className="text-xs leading-relaxed text-muted-foreground mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}
      {children}
    </motion.div>
  );
}

function Delta({ now, prev, invert = false }: { now: number; prev: number; invert?: boolean }) {
  if (prev === 0) return null;
  const pct = ((now - prev) / prev) * 100;
  const up  = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${good ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta }: {
  icon: React.ElementType; label: string; value: string; sub?: string; delta?: React.ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className="admin-kpi bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-5">
        <Icon className="size-4 text-brass-deep" strokeWidth={2} /> {label}
      </div>
      <p className="admin-kpi-value font-sans text-3xl font-semibold leading-tight tracking-tight tabular-nums">{value}</p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {sub && <p className="text-xs text-muted-foreground font-medium">{sub}</p>}
        {delta}
      </div>
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status.toLowerCase()] ?? STATUS_COLOR.unknown;
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border"
      style={{ background: color + "10", color, borderColor: color + "30" }}
    >
      {status}
    </span>
  );
}

function RangeTab({ value, active, onClick }: { value: TimeRange; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 text-xs eyebrow transition-all rounded-md border ${
        active
          ? "border-coal bg-coal text-bone shadow-e1"
          : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {value}
    </button>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { background: COAL, border: "none", color: BONE, fontSize: 12, borderRadius: 6, padding: "8px 12px", boxShadow: "0 8px 24px -8px rgba(20,20,20,0.3)" },
  cursor: { fill: COAL + "06" },
  itemStyle: { color: BONE },
};

function fmtRs(v: number) { return `Rs ${Math.round(v).toLocaleString()}`; }
function fmtK(v: number)  { return v >= 1000 ? `Rs ${(v / 1000).toFixed(0)}k` : `Rs ${Math.round(v)}`; }

// ─── Sections ─────────────────────────────────────────────────────────────────

function KpiStrip({ d }: { d: AnalyticsData }) {
  const k = d.kpi;
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 gap-4">
      <Kpi
        icon={TrendingUp}
        label="Revenue · 30 days"
        value={fmtRs(k.revenue_30d)}
        sub={`Today ${fmtRs(k.revenue_today)}`}
        delta={<Delta now={k.revenue_30d} prev={k.revenue_prev_30d} />}
      />
      <Kpi
        icon={ShoppingBag}
        label="Orders · 30 days"
        value={k.orders_30d.toLocaleString()}
        sub={`Today ${k.orders_today}`}
        delta={<Delta now={k.orders_30d} prev={k.orders_prev_30d} />}
      />
      <Kpi
        icon={BarChart2}
        label="Average order value"
        value={fmtRs(k.aov_30d)}
        sub="Avg order value"
      />
      <Kpi
        icon={Users}
        label="Customers"
        value={k.customers_total.toLocaleString()}
        sub="Total registered"
      />
      <Kpi
        icon={Package}
        label="Products"
        value={k.products_total.toLocaleString()}
        sub="In catalogue"
      />
      <Kpi
        icon={Zap}
        label="Open orders"
        value={k.pending_orders.toLocaleString()}
        sub="Pending / processing"
        delta={k.pending_orders > 10
          ? <span className="text-xs text-amber-600 font-semibold">Action needed</span>
          : undefined}
      />
    </motion.div>
  );
}

function RevenueChart({ d }: { d: AnalyticsData }) {
  const [range, setRange] = useState<TimeRange>("30d");
  const series = range === "7d" ? d.series7d : range === "30d" ? d.series30d : d.series90d;
  const tickFmt = (v: string) => v.slice(5);

  return (
    <Panel title="Revenue & Order Volume" subtitle="Daily revenue (bars) with order count (line)">
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit mb-6">
        {(["7d","30d","90d"] as TimeRange[]).map(r => (
          <RangeTab key={r} value={r} active={range === r} onClick={() => setRange(r)} />
        ))}
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ left: 0, right: 24, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COAL + "08"} vertical={false} />
            <XAxis dataKey="date" tickFormatter={tickFmt} stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} dy={10} />
            <YAxis yAxisId="rev" stroke={MUTED} fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} dx={-10} width={56} />
            <YAxis yAxisId="ord" orientation="right" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} dx={10} width={28} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: any, name: string) =>
                name === "revenue" ? [fmtRs(Number(v)), "Revenue"] : [v, "Orders"]
              }
            />
            <Bar yAxisId="rev" dataKey="revenue" fill={GOLD} radius={[4,4,0,0]} opacity={0.9} />
            <Line yAxisId="ord" type="monotone" dataKey="orders" stroke={COAL} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: COAL, stroke: BONE, strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function OrdersByStatus({ d }: { d: AnalyticsData }) {
  const data = d.ordersByStatus;
  const max  = Math.max(...data.map(x => x.count), 1);
  return (
    <Panel title="Orders by Status" subtitle="All time — count & revenue per state">
      <div className="space-y-4">
        {data.map(row => (
          <div key={row.status} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <StatusBadge status={row.status} />
              <div className="text-right">
                <span className="text-sm font-bold text-foreground">{row.count}</span>
                <span className="text-xs font-medium text-muted-foreground ml-2 w-16 inline-block">{fmtRs(row.revenue)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${(row.count / max) * 100}%`,
                  background: STATUS_COLOR[row.status] ?? STATUS_COLOR.unknown,
                }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No orders yet.</p>}
      </div>
    </Panel>
  );
}

function PaymentSplit({ d }: { d: AnalyticsData }) {
  const data = d.paymentSplit;
  const total = data.reduce((s, x) => s + x.count, 0);
  return (
    <Panel title="Payment Methods" subtitle="Last 30 days — COD vs Prepaid">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No data.</p>
      ) : (
        <>
          <div className="h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="method" cx="50%" cy="50%"
                  innerRadius={56} outerRadius={84} paddingAngle={4} strokeWidth={0}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: string) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {data.map((row, i) => (
              <div key={row.method} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded border border-coal/10" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="font-medium text-foreground">{row.method}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{total > 0 ? ((row.count / total) * 100).toFixed(1) : 0}%</span>
                  <span className="text-muted-foreground text-xs ml-3 font-medium w-16 inline-block">{fmtRs(row.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function CityMap({ d }: { d: AnalyticsData }) {
  const data = d.cities;
  return (
    <Panel title="Geographic Distribution" subtitle="Top cities by revenue — all time">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No shipping data yet.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COAL + "06"} horizontal={false} />
                <XAxis type="number" stroke={MUTED} fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="city" stroke={MUTED} fontSize={11} width={80} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [fmtRs(Number(v)), "Revenue"]} cursor={{ fill: COAL + "04" }} />
                <Bar dataKey="revenue" fill={GOLD} radius={[0,4,4,0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Mobile: compact city cards */}
          <div className="lg:hidden space-y-2">
            {data.map(row => (
              <div key={row.city} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-secondary/30 text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <MapPin className="size-3.5 text-brass shrink-0" />{row.city}
                </span>
                <div className="text-right">
                  <p className="font-bold text-foreground">{fmtRs(row.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{row.orders} orders</p>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: full table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border eyebrow text-muted-foreground">
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium text-right">Orders</th>
                  <th className="pb-3 font-medium text-right">Revenue</th>
                  <th className="pb-3 font-medium text-right">AOV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map(row => (
                  <tr key={row.city} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3 font-medium text-foreground flex items-center gap-2">
                      <MapPin className="size-3.5 text-brass shrink-0" />
                      {row.city}
                    </td>
                    <td className="py-3 text-right font-medium">{row.orders}</td>
                    <td className="py-3 text-right font-bold text-foreground">{fmtRs(row.revenue)}</td>
                    <td className="py-3 text-right text-muted-foreground text-xs">{fmtRs(row.aov)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

function TimingAnalysis({ d }: { d: AnalyticsData }) {
  const peakHour = d.hourly.reduce((a, b) => (b.orders > a.orders ? b : a), d.hourly[0]);
  const peakDay  = d.weekday.reduce((a, b) => (b.orders > a.orders ? b : a), d.weekday[0]);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Panel title="Orders by Hour" subtitle={`Peak: ${peakHour?.label ?? "—"} · when customers order most`}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.hourly} margin={{ left: -20, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COAL + "06"} vertical={false} />
              <XAxis dataKey="label" stroke={MUTED} fontSize={10} interval={2} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke={MUTED} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [v, "Orders"]} cursor={{ fill: COAL + "04" }} />
              <Bar dataKey="orders" radius={[4,4,0,0]}>
                {d.hourly.map((entry, i) => (
                  <Cell key={i} fill={entry.hour === peakHour?.hour ? GOLD : COAL + "15"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Orders by Day of Week" subtitle={`Busiest: ${peakDay?.day ?? "—"} · plan inventory around this`}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.weekday} margin={{ left: -20, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COAL + "06"} vertical={false} />
              <XAxis dataKey="short" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: string) => name === "revenue" ? [fmtRs(Number(v)), "Revenue"] : [v, "Orders"]} cursor={{ fill: COAL + "04" }} />
              <Bar dataKey="orders" radius={[4,4,0,0]} barSize={32}>
                {d.weekday.map((entry, i) => (
                  <Cell key={i} fill={entry.day === peakDay?.day ? GOLD : COAL + "15"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

function TopProductsTable({ d }: { d: AnalyticsData }) {
  return (
    <Panel title="Top Products by Revenue" subtitle="Ranked by total revenue generated — all time">
      {d.topByRevenue.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No sales data yet.</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {d.topByRevenue.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30">
                <span className="shrink-0 w-6 text-center">
                  {i < 3
                    ? <Award className="size-4 mx-auto" style={{ color: ["#c9a14a","#9ca3af","#b45309"][i] }} />
                    : <span className="text-muted-foreground text-xs font-mono">{i + 1}</span>}
                </span>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="size-10 object-cover rounded bg-secondary shrink-0 border border-border" />
                  : <div className="size-10 bg-secondary rounded shrink-0 border border-border flex items-center justify-center"><Package className="size-4 text-muted-foreground" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm line-clamp-1">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category || "Uncategorized"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm" style={{ color: GOLD }}>{fmtRs(p.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{p.units} units</p>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border eyebrow text-muted-foreground">
                  <th className="pb-3 font-medium w-8 text-center">#</th>
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium text-right">Units</th>
                  <th className="pb-3 font-medium text-right">Revenue</th>
                  <th className="pb-3 font-medium text-right">Avg Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.topByRevenue.map((p, i) => (
                  <tr key={p.id} className="hover:bg-secondary/40 transition-colors group">
                    <td className="py-3 text-center">
                      {i < 3
                        ? <Award className="size-4 mx-auto" style={{ color: ["#c9a14a","#9ca3af","#b45309"][i] }} />
                        : <span className="text-muted-foreground text-xs font-mono">{i + 1}</span>}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl
                          ? <img src={p.imageUrl} alt={p.name} className="size-10 object-cover rounded bg-secondary shrink-0 shadow-e1 border border-border" />
                          : <div className="size-10 bg-secondary rounded shrink-0 shadow-e1 border border-border flex items-center justify-center"><Package className="size-4 text-muted-foreground" /></div>}
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground line-clamp-1">{p.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.category || "Uncategorized"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right font-semibold">{p.units.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold" style={{ color: GOLD }}>{fmtRs(p.revenue)}</td>
                    <td className="py-3 text-right text-muted-foreground text-xs font-medium">{fmtRs(p.aov)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

function CategoryRevenue({ d }: { d: AnalyticsData }) {
  return (
    <Panel title="Category Performance" subtitle="Revenue & units per product category">
      {d.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.categories} layout="vertical" margin={{ left: 0, right: 16, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COAL + "06"} horizontal={false} />
              <XAxis type="number" stroke={MUTED} fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="category" stroke={MUTED} fontSize={11} width={100} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: string) => name === "revenue" ? [fmtRs(Number(v)), "Revenue"] : [v, "Units"]} cursor={{ fill: COAL + "04" }} />
              <Bar dataKey="revenue" fill={GOLD} radius={[0,4,4,0]} name="revenue" barSize={12} />
              <Bar dataKey="units" fill={COAL + "30"} radius={[0,4,4,0]} name="units" barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function OrderValueDist({ d }: { d: AnalyticsData }) {
  const total = d.valueBuckets.reduce((s, x) => s + x.count, 0);
  return (
    <Panel title="Order Value Distribution" subtitle="How order sizes are spread">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.valueBuckets} margin={{ left: -20, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COAL + "06"} vertical={false} />
              <XAxis dataKey="label" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v} orders (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`, "Count"]} cursor={{ fill: COAL + "04" }} />
              <Bar dataKey="count" fill={COAL} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function CustomerRepeatRate({ d }: { d: AnalyticsData }) {
  const total = d.repeatRate.reduce((s, x) => s + x.count, 0);
  const COLORS = [COAL, GOLD];
  return (
    <Panel title="Customer Repeat Rate" subtitle="New vs returning buyers (by order count)">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
      ) : (
        <>
          <div className="h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.repeatRate} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={56} outerRadius={84} paddingAngle={4} strokeWidth={0}>
                  {d.repeatRate.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: string) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {d.repeatRate.map((row, i) => (
              <div key={row.type} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded border border-coal/10" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="font-medium text-foreground">{row.type} customers</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{total > 0 ? ((row.count / total) * 100).toFixed(1) : 0}%</span>
                  <span className="text-muted-foreground text-xs ml-3 font-medium w-16 inline-block text-right">{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function RecentOrdersFeed({ d }: { d: AnalyticsData }) {
  return (
    <Panel title="Recent Orders" subtitle="Last 15 orders — live feed">
      {d.recentOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2.5">
            {d.recentOrders.map(o => {
              const when = new Date(o.createdAt);
              const diff = Date.now() - when.getTime();
              const ago = diff < 3600000
                ? `${Math.round(diff / 60000)}m ago`
                : diff < 86400000
                ? `${Math.round(diff / 3600000)}h ago`
                : when.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
              return (
                <div key={o.id} className="p-3 rounded-xl border border-border bg-secondary/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{o.ref}</span>
                    <span className="text-xs text-muted-foreground">{ago}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={o.status} />
                      <span className="text-xs text-muted-foreground">{o.city}</span>
                    </div>
                    <span className="font-bold text-sm text-foreground">{fmtRs(o.total)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{o.method}</span>
                    <span>·</span>
                    <span>{o.itemCount} item{o.itemCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border eyebrow text-muted-foreground">
                  <th className="pb-3 font-medium">Ref</th>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Method</th>
                  <th className="pb-3 font-medium text-right">Items</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                  <th className="pb-3 font-medium text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.recentOrders.map(o => {
                  const when = new Date(o.createdAt);
                  const diff = Date.now() - when.getTime();
                  const ago  = diff < 3600000
                    ? `${Math.round(diff / 60000)}m ago`
                    : diff < 86400000
                    ? `${Math.round(diff / 3600000)}h ago`
                    : when.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
                  return (
                    <tr key={o.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3 font-mono font-medium text-xs">{o.ref}</td>
                      <td className="py-3 text-muted-foreground">{o.city}</td>
                      <td className="py-3"><StatusBadge status={o.status} /></td>
                      <td className="py-3 text-muted-foreground">{o.method}</td>
                      <td className="py-3 text-right font-medium">{o.itemCount}</td>
                      <td className="py-3 text-right font-bold text-foreground">{fmtRs(o.total)}</td>
                      <td className="py-3 text-right text-muted-foreground text-xs">{ago}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-secondary border border-border rounded-xl ${className}`} />;
}

function LoadingState() {
  return (
    <div className="space-y-8 pb-16">
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-96" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-80" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function AdminDashboard() {
  const { user } = useAuth();
  const { data: timeStats } = useQuery({
    queryKey: ["my-time-stats", user?._id],
    queryFn: () => adminGetUserTimeStats(user!._id),
    enabled: !!user,
  });

  const timeAgo = (v: string) => {
    if (!v) return "Never";
    const diff = Date.now() - new Date(v).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const fmtDuration = (ms: number) => {
    if (!ms) return "0m";
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `${day}d ${hr % 24}h`;
    if (hr > 0) return `${hr}h ${min % 60}m`;
    return `${min}m`;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["analytics-heavy"],
    queryFn: fetchAnalytics,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-10 text-center text-sm text-red-600">
        <p className="font-semibold text-lg mb-1">Analytics could not load</p>
        <p className="mb-6 opacity-80">Check the backend is running and you are logged in as admin.</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-e1"
        >
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  const generated = new Date(data.generatedAt);

  return (
    <div className="space-y-8 pb-16">
      <section className="admin-welcome">
        <div>
          <p className="admin-overline">YOUR BUSINESS, AT A GLANCE</p>
          <h1>Welcome back, {user?.name?.split(" ")[0] || "Admin"}<span>.</span></h1>
          <p className="admin-welcome-description">A little clarity for your day. Here is how your store is doing.</p>
          {user && <p className="admin-role-label">{getAdminRole(user.email)?.title || user.title || "Administrator"}</p>}
        </div>
        <Link to="/admin/orders" className="admin-primary-link">Manage orders <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </section>

      <nav className="admin-quick-links" aria-label="Quick actions">
        <Link to="/admin/products"><Package size={17} aria-hidden="true" /><span>Manage catalog</span><ArrowUpRight size={14} aria-hidden="true" /></Link>
        <Link to="/admin/orders"><ShoppingBag size={17} aria-hidden="true" /><span>Review orders</span><ArrowUpRight size={14} aria-hidden="true" /></Link>
        <Link to="/admin/users"><Users size={17} aria-hidden="true" /><span>Customers</span><ArrowUpRight size={14} aria-hidden="true" /></Link>
      </nav>

      {/* Time invested card */}
      {user && timeStats?.stats && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="admin-session-card bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Timer className="size-6 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="eyebrow text-muted-foreground text-[10px]">Time Invested</p>
            <p className="font-display text-2xl font-bold text-foreground tracking-tight mt-0.5">{fmtDuration(timeStats.stats.totalDurationMs)}</p>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{timeStats.stats.totalSessions ?? 0}</p>
              <p className="eyebrow text-[10px] text-muted-foreground">Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{timeStats.stats.activeSessions ?? 0}</p>
              <p className="eyebrow text-[10px] text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{timeStats.stats.lastActiveAt ? timeAgo(timeStats.stats.lastActiveAt) : "—"}</p>
              <p className="eyebrow text-[10px] text-muted-foreground">Last Active</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl tracking-tight">Store performance</h2>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Clock className="size-3" />
            Snapshot at {generated.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg text-sm font-semibold hover:bg-secondary transition shadow-e1 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin text-brass" : "text-muted-foreground"}`} />
          Refresh
        </button>
      </motion.div>

      {/* KPI Strip */}
      <KpiStrip d={data} />

      {/* Revenue Chart */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <RevenueChart d={data} />
      </motion.div>

      {/* Status + Payment */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid lg:grid-cols-2 gap-6">
        <OrdersByStatus d={data} />
        <PaymentSplit   d={data} />
      </motion.div>

      {/* City Map */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <CityMap d={data} />
      </motion.div>

      {/* Timing */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show">
        <TimingAnalysis d={data} />
      </motion.div>

      {/* Top Products */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <TopProductsTable d={data} />
      </motion.div>

      {/* Category + Value Distribution */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid lg:grid-cols-2 gap-6">
        <CategoryRevenue  d={data} />
        <OrderValueDist   d={data} />
      </motion.div>

      {/* Customer repeat */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid lg:grid-cols-2 gap-6">
        <CustomerRepeatRate d={data} />
        <Panel title="Revenue Split by Day-of-Week" subtitle="Which days generate most revenue">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekday} margin={{ left: -10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COAL + "06"} vertical={false} />
                <XAxis dataKey="short" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke={MUTED} fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [fmtRs(Number(v)), "Revenue"]} cursor={{ fill: COAL + "04" }} />
                <Bar dataKey="revenue" fill={GOLD} radius={[4,4,0,0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </motion.div>

      {/* Recent Orders */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <RecentOrdersFeed d={data} />
      </motion.div>
    </div>
  );
}
