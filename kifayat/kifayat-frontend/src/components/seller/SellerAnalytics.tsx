import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, Boxes, CheckCircle2, Clock3, Gauge, Image, ListChecks, Package, PackageCheck, Tags, TrendingUp } from "lucide-react";
import type { SellerAccount, SellerAnalytics as SellerAnalyticsData } from "@/lib/seller.functions";
import { SellerAccountDossier } from "@/components/seller/SellerAccountDossier";

const GOLD = "#c9a14a";
const COAL = "#1a1a1a";

function money(value: number) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-PK")}`;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function KpiCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string; detail: string }) {
  return (
    <div className="border border-coal/10 bg-paper p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[10px] eyebrow text-coal/50">
        <Icon className="size-4 text-brass" strokeWidth={1.7} /> {label}
      </div>
      <p className="mt-4 font-display italic text-2xl sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-coal/55">{detail}</p>
    </div>
  );
}

export function SellerAnalytics({ analytics, seller, admin = false }: { analytics: SellerAnalyticsData; seller?: SellerAccount; admin?: boolean }) {
  const { kpi } = analytics;
  const topProducts = analytics.products.filter((product) => product.revenue > 0).slice(0, 8);
  const series = analytics.series.map((point) => ({ ...point, label: shortDate(point.date) }));
  const account = seller || analytics.account;
  const periods = [
    ["7 days", analytics.periods.last7],
    ["30 days", analytics.periods.last30],
    ["90 days", analytics.periods.last90],
    ["All time", analytics.periods.allTime],
  ] as const;

  return (
    <section className={admin ? "space-y-5" : "mt-10 space-y-6"} aria-label="Seller analytics">
      <SellerAccountDossier seller={account} analytics={analytics} admin={admin} />
      <div className="border border-coal/10 bg-paper p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[10px] text-brass mb-1">Account health score</p>
            <h2 className="font-display italic text-2xl sm:text-3xl">{analytics.health.score}<span className="text-base not-italic text-coal/35"> / 100</span></h2>
            <p className="mt-1 text-xs text-coal/55">A practical operating score based on catalog quality, stock coverage, sales activity, and order outcomes.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Gauge className="size-5 text-brass" /> {analytics.health.label}</div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-coal/10"><div className={`h-full rounded-full ${analytics.health.score >= 80 ? "bg-emerald-600" : analytics.health.score >= 55 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${analytics.health.score}%` }} /></div>
        <div className="mt-5 grid md:grid-cols-3 gap-3">
          {analytics.health.signals.map((signal) => (
            <div key={`${signal.title}-${signal.detail}`} className={`border p-3.5 ${signal.tone === "critical" ? "border-red-200 bg-red-50/60" : signal.tone === "warning" ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
              <div className="flex items-start gap-2"><span className={`mt-1 size-2 rounded-full shrink-0 ${signal.tone === "critical" ? "bg-red-500" : signal.tone === "warning" ? "bg-amber-500" : "bg-emerald-600"}`} /><div><p className="text-xs font-semibold">{signal.title}</p><p className="mt-1 text-[11px] leading-relaxed text-coal/60">{signal.detail}</p></div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-[10px] text-brass mb-1">{admin ? "Complete monitoring" : "Store intelligence"}</p>
          <h2 className="font-display italic text-2xl sm:text-3xl">Product performance</h2>
          <p className="mt-1 text-xs text-coal/55">All recorded order stages, inventory health, and product-level revenue.</p>
        </div>
        <p className="text-[10px] eyebrow text-coal/40">Updated {new Date(analytics.generatedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Total revenue" value={money(kpi.totalRevenue)} detail={`${money(kpi.revenue30d)} in the last 30 days`} />
        <KpiCard icon={Package} label="Units sold" value={kpi.totalUnitsSold.toLocaleString()} detail={`${kpi.totalOrders} tracked orders`} />
        <KpiCard icon={Boxes} label="Inventory value" value={money(kpi.inventoryValue)} detail={`${kpi.activeProducts} active products`} />
        <KpiCard icon={AlertTriangle} label="Stock watch" value={`${kpi.lowStockProducts + kpi.outOfStockProducts}`} detail={`${kpi.lowStockProducts} low · ${kpi.outOfStockProducts} out`} />
        <KpiCard icon={PackageCheck} label="Delivery rate" value={`${analytics.fulfillment.deliveryRate.toFixed(1)}%`} detail={`${kpi.deliveredOrders} delivered orders`} />
        <KpiCard icon={ArrowUpRight} label="Average order" value={money(kpi.averageOrderValue)} detail={`${kpi.orders30d} orders in 30 days`} />
        <KpiCard icon={ListChecks} label="Listing quality" value={`${analytics.catalog.listingCompleteness}%`} detail={`${analytics.catalog.withImages} with images · ${analytics.catalog.withDescriptions} categorized`} />
        <KpiCard icon={Tags} label="Active categories" value={analytics.catalog.categories.filter((category) => category.activeProducts > 0).length.toLocaleString()} detail={`${analytics.catalog.totalStockUnits.toLocaleString()} units on hand`} />
      </div>

      <div className="border border-coal/10 bg-paper overflow-x-auto">
        <div className="p-5 sm:p-6 pb-3"><h3 className="font-semibold text-sm">Operating period comparison</h3><p className="mt-1 text-xs text-coal/50">Use the different windows to separate recent momentum from lifetime scale.</p></div>
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className="border-y border-coal/10 text-left text-[10px] eyebrow text-coal/45"><th className="px-5 py-3">Window</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">Orders</th><th className="px-3 py-3 text-right">Units</th><th className="px-5 py-3 text-right">Avg. order</th></tr></thead>
          <tbody>{periods.map(([label, value]) => <tr key={label} className="border-b border-coal/7 last:border-0"><td className="px-5 py-3.5 font-medium">{label}</td><td className="px-3 py-3.5 text-right font-semibold">{money(value.revenue)}</td><td className="px-3 py-3.5 text-right">{value.orders.toLocaleString()}</td><td className="px-3 py-3.5 text-right">{value.units.toLocaleString()}</td><td className="px-5 py-3.5 text-right">{money(value.orders ? value.revenue / value.orders : 0)}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-[1.45fr_1fr] gap-5">
        <div className="border border-coal/10 bg-paper p-5 sm:p-6">
          <h3 className="font-semibold text-sm">Revenue trend</h3>
          <p className="mt-1 mb-5 text-xs text-coal/50">Daily seller revenue over the last 30 days</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${COAL}10`} vertical={false} />
                <XAxis dataKey="label" interval={4} tickLine={false} axisLine={false} fontSize={10} stroke={`${COAL}70`} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} stroke={`${COAL}70`} tickFormatter={(value) => `Rs ${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value: any, name: string) => [name === "revenue" ? money(Number(value)) : value, name === "revenue" ? "Revenue" : "Orders"]} />
                <Line type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-coal/10 bg-paper p-5 sm:p-6">
          <h3 className="font-semibold text-sm">Order health</h3>
          <p className="mt-1 mb-5 text-xs text-coal/50">Every order currently attributed to this seller</p>
          <div className="space-y-3">
            {analytics.statuses.length ? analytics.statuses.map((status) => (
              <div key={status.status} className="flex items-center gap-3">
                <span className="size-2 rounded-full bg-brass shrink-0" />
                <span className="text-sm flex-1">{statusLabel(status.status)}</span>
                <span className="text-xs text-coal/50">{status.orders}</span>
                <span className="text-xs font-semibold w-24 text-right">{money(status.revenue)}</span>
              </div>
            )) : <p className="text-sm text-coal/50 py-8">No orders recorded yet.</p>}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-7 pt-5 border-t border-coal/10 text-center">
            <div><CheckCircle2 className="size-4 mx-auto text-emerald-600" /><p className="mt-2 font-semibold">{kpi.deliveredOrders}</p><p className="text-[10px] eyebrow text-coal/45">Delivered</p></div>
            <div><Clock3 className="size-4 mx-auto text-amber-600" /><p className="mt-2 font-semibold">{kpi.pendingOrders}</p><p className="text-[10px] eyebrow text-coal/45">Pending</p></div>
            <div><AlertTriangle className="size-4 mx-auto text-red-500" /><p className="mt-2 font-semibold">{kpi.cancelledOrders}</p><p className="text-[10px] eyebrow text-coal/45">Cancelled</p></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.35fr] gap-5">
        <div className="border border-coal/10 bg-paper p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><ListChecks className="size-4 text-brass" /><h3 className="font-semibold text-sm">Catalog audit</h3></div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4"><span className="text-sm text-coal/65">Live listings</span><strong>{analytics.catalog.activeProducts} <span className="text-xs font-normal text-coal/45">of {kpi.productsTotal}</span></strong></div>
            <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-sm text-coal/65"><Image className="size-3.5 text-brass" /> Product images</span><strong>{analytics.catalog.withImages}/{analytics.catalog.activeProducts}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-sm text-coal/65">Categorized listings</span><strong>{analytics.catalog.withDescriptions}/{analytics.catalog.activeProducts}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-sm text-coal/65">Listings with a sale</span><strong>{analytics.catalog.withSales}/{kpi.productsTotal}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-sm text-coal/65">Hidden / deleted</span><strong>{analytics.catalog.hiddenProducts} / {analytics.catalog.deletedProducts}</strong></div>
          </div>
          <div className="mt-6 pt-5 border-t border-coal/10"><div className="flex items-center justify-between text-xs"><span className="text-coal/55">Listing completeness</span><strong>{analytics.catalog.listingCompleteness}%</strong></div><div className="mt-2 h-2 rounded-full bg-coal/10 overflow-hidden"><div className="h-full rounded-full bg-brass" style={{ width: `${analytics.catalog.listingCompleteness}%` }} /></div></div>
        </div>
        <div className="border border-coal/10 bg-paper p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><PackageCheck className="size-4 text-brass" /><h3 className="font-semibold text-sm">Fulfillment & risk signals</h3></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 p-4"><p className="text-[10px] eyebrow text-emerald-700">Delivered</p><p className="mt-2 font-display italic text-2xl text-emerald-800">{analytics.fulfillment.deliveryRate.toFixed(1)}%</p><p className="mt-1 text-[11px] text-emerald-800/65">{money(analytics.fulfillment.deliveredRevenue)} value</p></div>
            <div className="bg-amber-50 border border-amber-100 p-4"><p className="text-[10px] eyebrow text-amber-700">Pending</p><p className="mt-2 font-display italic text-2xl text-amber-800">{analytics.fulfillment.pendingRate.toFixed(1)}%</p><p className="mt-1 text-[11px] text-amber-800/65">{kpi.pendingOrders} orders in queue</p></div>
            <div className="bg-red-50 border border-red-100 p-4"><p className="text-[10px] eyebrow text-red-700">Cancelled</p><p className="mt-2 font-display italic text-2xl text-red-800">{analytics.fulfillment.cancellationRate.toFixed(1)}%</p><p className="mt-1 text-[11px] text-red-800/65">{money(analytics.fulfillment.cancelledRevenue)} at risk</p></div>
          </div>
          <div className="mt-6 pt-5 border-t border-coal/10 grid grid-cols-2 gap-4 text-sm"><div><p className="text-[10px] eyebrow text-coal/45">Stock units on hand</p><p className="mt-1 font-semibold">{analytics.catalog.totalStockUnits.toLocaleString()}</p></div><div><p className="text-[10px] eyebrow text-coal/45">Average listing price</p><p className="mt-1 font-semibold">{money(analytics.catalog.averageProductPrice)}</p></div></div>
        </div>
      </div>

      <div className="border border-coal/10 bg-paper overflow-x-auto">
        <div className="p-5 sm:p-6 pb-3"><div className="flex items-center gap-2"><Tags className="size-4 text-brass" /><h3 className="font-semibold text-sm">Category performance</h3></div><p className="mt-1 text-xs text-coal/50">Where this seller’s assortment is concentrated and where revenue is actually coming from.</p></div>
        {analytics.catalog.categories.length ? <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-y border-coal/10 text-left text-[10px] eyebrow text-coal/45"><th className="px-5 py-3">Category</th><th className="px-3 py-3 text-right">Listings</th><th className="px-3 py-3 text-right">Stock</th><th className="px-3 py-3 text-right">Units sold</th><th className="px-3 py-3 text-right">Orders</th><th className="px-5 py-3 text-right">Revenue</th></tr></thead>
          <tbody>{analytics.catalog.categories.map((category) => <tr key={category.category} className="border-b border-coal/7 last:border-0"><td className="px-5 py-3.5 font-medium">{category.category}</td><td className="px-3 py-3.5 text-right">{category.activeProducts}<span className="text-xs text-coal/40"> / {category.products}</span></td><td className="px-3 py-3.5 text-right">{category.stockUnits.toLocaleString()}</td><td className="px-3 py-3.5 text-right">{category.unitsSold.toLocaleString()}</td><td className="px-3 py-3.5 text-right">{category.orders.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold">{money(category.revenue)}</td></tr>)}</tbody>
        </table> : <p className="p-8 text-center text-sm text-coal/50">Category analysis will appear once products are added.</p>}
      </div>

      <div className="border border-coal/10 bg-paper p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div><h3 className="font-semibold text-sm">Top products by revenue</h3><p className="mt-1 text-xs text-coal/50">Product-level contribution across all tracked orders</p></div>
          <span className="text-xs text-coal/50">{money(kpi.averageOrderValue)} average order</span>
        </div>
        {topProducts.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${COAL}10`} horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={10} stroke={`${COAL}70`} tickFormatter={(value) => `Rs ${Math.round(Number(value) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} fontSize={10} stroke={`${COAL}70`} tickFormatter={(value) => String(value).slice(0, 18)} />
                <Tooltip formatter={(value: any) => [money(Number(value)), "Revenue"]} />
                <Bar dataKey="revenue" fill={GOLD} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-12 text-center text-sm text-coal/50">Your product revenue will appear after the first order.</p>}
      </div>

      <div className="border border-coal/10 bg-paper overflow-x-auto">
        <div className="p-5 sm:p-6 pb-3"><h3 className="font-semibold text-sm">Complete product monitoring</h3><p className="mt-1 text-xs text-coal/50">Sales, revenue, stock, and visibility for every product</p></div>
        <table className="w-full min-w-[700px] text-sm">
          <thead><tr className="border-y border-coal/10 text-left text-[10px] eyebrow text-coal/45"><th className="px-5 py-3">Product</th><th className="px-3 py-3 text-right">Units sold</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">Stock</th><th className="px-5 py-3 text-right">Status</th></tr></thead>
          <tbody>
            {analytics.products.map((product) => (
              <tr key={product.id} className="border-b border-coal/7 last:border-0">
                <td className="px-5 py-3.5"><p className="font-medium">{product.name}</p><p className="text-[11px] text-coal/45">{product.category}{product.sku ? ` · ${product.sku}` : ""}</p></td>
                <td className="px-3 py-3.5 text-right tabular-nums">{product.unitsSold.toLocaleString()}</td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{money(product.revenue)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums">{product.stock.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right"><span className={`text-[10px] eyebrow ${product.deleted ? "text-red-600" : product.hidden ? "text-amber-600" : product.stock <= 0 ? "text-red-600" : product.stock <= 5 ? "text-amber-600" : "text-emerald-600"}`}>{product.deleted ? "Deleted" : product.hidden ? "Hidden" : product.stock <= 0 ? "Out of stock" : product.stock <= 5 ? "Low stock" : "Live"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!analytics.products.length && <p className="p-8 text-center text-sm text-coal/50">No products to monitor yet.</p>}
      </div>

      <div className="border border-coal/10 bg-paper overflow-x-auto">
        <div className="p-5 sm:p-6 pb-3"><h3 className="font-semibold text-sm">Recent seller orders</h3><p className="mt-1 text-xs text-coal/50">Latest activity across checkout, pre-order, export, and history records</p></div>
        {analytics.recentOrders.length ? <table className="w-full min-w-[650px] text-sm">
          <thead><tr className="border-y border-coal/10 text-left text-[10px] eyebrow text-coal/45"><th className="px-5 py-3">Date</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">City</th><th className="px-3 py-3 text-right">Units</th><th className="px-5 py-3 text-right">Revenue</th></tr></thead>
          <tbody>{analytics.recentOrders.map((order) => <tr key={`${order.source}-${order.id}`} className="border-b border-coal/7 last:border-0"><td className="px-5 py-3">{shortDate(order.date)} <span className="ml-1 text-[10px] eyebrow text-coal/40">{statusLabel(order.status)}</span></td><td className="px-3 py-3 text-coal/60">{statusLabel(order.source)}</td><td className="px-3 py-3 text-coal/60">{order.city}</td><td className="px-3 py-3 text-right">{order.units}</td><td className="px-5 py-3 text-right font-semibold">{money(order.revenue)}</td></tr>)}</tbody>
        </table> : <p className="p-8 text-center text-sm text-coal/50">No seller orders recorded yet.</p>}
      </div>
    </section>
  );
}