import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownUp, RefreshCw, Search, ShieldCheck, Store, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { getSellerMonitoring } from "@/lib/seller.functions";
import { SellerAnalytics } from "@/components/seller/SellerAnalytics";

export const Route = createFileRoute("/_authenticated/admin/sellers")({
  component: AdminSellerMonitoring,
});

function AdminSellerMonitoring() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"revenue" | "health" | "recent">("revenue");
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["admin", "seller-monitoring"],
    queryFn: getSellerMonitoring,
    staleTime: 60_000,
  });
  const sellerRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(data?.sellers ?? [])]
      .filter(({ seller }) => !normalizedQuery || [seller.storeName, seller.name, seller.email, seller.storeSlug].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => {
        if (sort === "health") return b.analytics.health.score - a.analytics.health.score;
        if (sort === "recent") return new Date(b.seller.lastActiveAt || 0).getTime() - new Date(a.seller.lastActiveAt || 0).getTime();
        return b.analytics.kpi.totalRevenue - a.analytics.kpi.totalRevenue;
      });
  }, [data?.sellers, query, sort]);
  const portfolio = useMemo(() => {
    const rows = data?.sellers ?? [];
    return {
      sellers: rows.length,
      active: rows.filter(({ seller }) => seller.accountStatus === "active").length,
      revenue: rows.reduce((sum, row) => sum + row.analytics.kpi.totalRevenue, 0),
      orders: rows.reduce((sum, row) => sum + row.analytics.kpi.totalOrders, 0),
    };
  }, [data?.sellers]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-72 bg-secondary rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 bg-secondary rounded-xl animate-pulse" />)}</div>
        <div className="h-80 bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="admin-overline">SELLER OPERATIONS</p>
          <h1 className="mt-2">Seller monitoring<span>.</span></h1>
          <p className="admin-welcome-description mt-2">Complete product, inventory, order, and revenue visibility across every seller account.</p>
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg text-sm font-semibold hover:bg-secondary transition shadow-e1 disabled:opacity-50">
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin text-brass" : "text-muted-foreground"}`} /> Refresh
        </button>
      </section>

      {isError ? (
        <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-10 text-center text-sm text-red-600">
          <p className="font-semibold text-lg mb-1">Seller monitoring could not load</p>
          <p className="mb-6 opacity-80">Check that you are signed in as an administrator and try again.</p>
          <button type="button" onClick={() => refetch()} className="px-5 py-2.5 bg-red-500 text-white rounded-lg font-semibold">Retry</button>
        </div>
      ) : data?.sellers?.length ? (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="admin-kpi border border-border bg-card rounded-xl p-4"><p className="flex items-center gap-2 text-[10px] eyebrow text-muted-foreground"><Store className="size-3.5 text-brass-deep" /> Seller accounts</p><p className="mt-3 text-2xl font-semibold">{portfolio.sellers}</p><p className="mt-1 text-xs text-muted-foreground">{portfolio.active} active in the last 30 days</p></div>
            <div className="admin-kpi border border-border bg-card rounded-xl p-4"><p className="flex items-center gap-2 text-[10px] eyebrow text-muted-foreground"><Activity className="size-3.5 text-brass-deep" /> Portfolio GMV</p><p className="mt-3 text-2xl font-semibold">Rs {Math.round(portfolio.revenue).toLocaleString("en-PK")}</p><p className="mt-1 text-xs text-muted-foreground">Across all attributed orders</p></div>
            <div className="admin-kpi border border-border bg-card rounded-xl p-4"><p className="flex items-center gap-2 text-[10px] eyebrow text-muted-foreground"><Users className="size-3.5 text-brass-deep" /> Attributed orders</p><p className="mt-3 text-2xl font-semibold">{portfolio.orders.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Checkout, pre-order, and archive</p></div>
            <div className="admin-kpi border border-border bg-card rounded-xl p-4"><p className="flex items-center gap-2 text-[10px] eyebrow text-muted-foreground"><ShieldCheck className="size-3.5 text-brass-deep" /> Verified sellers</p><p className="mt-3 text-2xl font-semibold">{data.sellers.filter(({ seller }) => seller.isVerified).length}</p><p className="mt-1 text-xs text-muted-foreground">Identity verification status</p></div>
          </section>
          <section className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card rounded-xl p-3">
            <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <Search className="size-4 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" placeholder="Search store, seller, email, or handle" />
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ArrowDownUp className="size-4 text-brass-deep" /><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none"><option value="revenue">Revenue</option><option value="health">Health score</option><option value="recent">Last active</option></select></label>
          </section>
          {sellerRows.length ? sellerRows.map(({ seller, analytics }) => (
            <section key={seller.id} className="space-y-5">
              <SellerAnalytics analytics={analytics} seller={seller} admin />
            </section>
          )) : <div className="border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">No seller accounts match “{query}”.</div>}
        </>
      ) : (
        <div className="border border-dashed border-border rounded-xl py-20 text-center">
          <Store className="size-10 mx-auto text-muted-foreground/40" strokeWidth={1.2} />
          <p className="mt-4 font-display text-2xl">No seller accounts yet</p>
        </div>
      )}
    </div>
  );
}