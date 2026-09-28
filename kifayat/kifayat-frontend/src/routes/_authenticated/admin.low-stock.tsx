import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminGetLowStockOrders, adminRemoveLowStockOrder, adminToggleFeaturedOnLanding, adminUpdateProduct } from "@/lib/admin.functions";
import { toast } from "sonner";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, XCircle, Package, ChevronDown, ChevronUp, Star, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/low-stock")({
  component: AdminLowStock,
});

const STOCK_THRESHOLD = 15;

function StockChip({ stock }: { stock: number }) {
  const s = stock ?? 0;
  return (
    <span className={`font-bold inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-md text-xs ${s === 0 ? "bg-red-500/10 text-red-600" : s <= 10 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
      {s}
    </span>
  );
}

function AdminLowStock() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "low-stock"],
    queryFn: adminGetLowStockOrders,
    refetchInterval: 15_000,
  });

  const removeMut = useMutation({
    mutationFn: (orderId: string) => adminRemoveLowStockOrder(orderId),
    onSuccess: () => {
      toast.success("Order removed from main_orders. Customer emailed.");
      qc.invalidateQueries({ queryKey: ["admin", "low-stock"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove."),
  });

  const featureMut = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      adminToggleFeaturedOnLanding(id, featured),
    onSuccess: () => {
      toast.success("Landing page feature updated.");
      qc.invalidateQueries({ queryKey: ["admin", "low-stock"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update."),
  });

  const hideMut = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      adminUpdateProduct(id, { hidden }),
    onSuccess: () => {
      toast.success("Visibility updated.");
      qc.invalidateQueries({ queryKey: ["admin", "low-stock"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update."),
  });

  const orders = data?.orders ?? [];
  const products = data?.products ?? [];
  const productCount = data?.productCount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass" /> Workflow
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Low Stock<span className="text-brass">.</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-2 font-medium">
          Products with stock below {STOCK_THRESHOLD} — plus orders affected by low stock.
        </p>
      </div>

      {/* ── Products with low stock ── */}
      <div className="bg-card border border-border shadow-e1 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Package className="size-4 text-amber-500 shrink-0" strokeWidth={1.5} />
            <h3 className="font-semibold text-foreground">Products with low stock</h3>
          </div>
          {productCount > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1 shrink-0">
              {productCount}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2.5 p-5" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="size-9 rounded-lg animate-pulse bg-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded animate-pulse bg-secondary" />
                  <div className="h-3 w-1/2 rounded animate-pulse bg-secondary" />
                </div>
                <div className="h-6 w-16 rounded-full animate-pulse bg-secondary shrink-0" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
            <Package className="size-8 mb-2 text-border" strokeWidth={1} />
            <p className="text-sm font-medium">All products are well stocked.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-5 py-3 eyebrow text-muted-foreground font-semibold">Product</th>
                  <th className="px-5 py-3 eyebrow text-muted-foreground font-semibold">Category</th>
                  <th className="px-5 py-3 eyebrow text-muted-foreground font-semibold text-right">Stock</th>
                  <th className="px-5 py-3 eyebrow text-muted-foreground font-semibold text-center">Status</th>
                  <th className="px-5 py-3 eyebrow text-muted-foreground font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p: any) => {
                  const inStock = (p.stock ?? 0) >= STOCK_THRESHOLD;
                  return (
                    <tr key={p._id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl.split(",")[0].split("?")[0].trim()} alt={p.name} className="size-9 object-cover bg-secondary border border-border shrink-0 rounded-lg" />
                          ) : (
                            <div className="size-9 bg-secondary border border-border shrink-0 rounded-lg grid place-items-center">
                              <Package className="size-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground line-clamp-1 max-w-[280px]">{p.name}</p>
                            {p.sku && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-muted-foreground">{p.category ?? "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <StockChip stock={p.stock ?? 0} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border ${inStock ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}>
                          {inStock ? "In stock" : "Out"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => featureMut.mutate({ id: p._id, featured: !(p.featuredOnLanding ?? false) })}
                            disabled={featureMut.isPending}
                            title={p.featuredOnLanding ? "Remove from landing page" : "Feature on landing page"}
                            className={`size-8 flex items-center justify-center border rounded-lg transition-all shadow-sm disabled:opacity-50 ${(p.featuredOnLanding ?? false) ? "border-brass bg-brass/10 text-brass" : "border-border bg-card hover:bg-secondary hover:border-brass/50 text-muted-foreground hover:text-brass"}`}
                          >
                            <Star className="size-3.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => hideMut.mutate({ id: p._id, hidden: !(p.hidden ?? false) })}
                            disabled={hideMut.isPending}
                            title={p.hidden ? "Show on store" : "Hide from store"}
                            className={`size-8 flex items-center justify-center border rounded-lg transition-all shadow-sm disabled:opacity-50 ${(p.hidden ?? false) ? "border-red-500/30 bg-red-500/5 text-red-500" : "border-border bg-card hover:bg-secondary hover:border-emerald-500/50 text-muted-foreground hover:text-emerald-600"}`}
                          >
                            {p.hidden ? <EyeOff className="size-3.5" strokeWidth={2} /> : <Eye className="size-3.5" strokeWidth={2} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 bg-card border border-border shadow-e1 rounded-2xl p-5" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="size-9 rounded-lg animate-pulse bg-secondary shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded animate-pulse bg-secondary" />
                <div className="h-3 w-1/2 rounded animate-pulse bg-secondary" />
              </div>
              <div className="h-6 w-20 rounded-full animate-pulse bg-secondary shrink-0" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border shadow-e1 rounded-2xl text-muted-foreground flex flex-col items-center">
          <Package className="size-10 mb-3 text-border" strokeWidth={1} />
          <p className="font-semibold text-foreground text-base">All clear</p>
          <p className="text-sm mt-1">No orders with low stock found.</p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{orders.length} order{orders.length !== 1 ? "s" : ""} need attention</span>
          </div>

          {orders.map((o: any) => {
            const isExpanded = expandedId === o.orderId;
            return (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                key={o.orderId}
                className="bg-card border border-amber-200 dark:border-amber-800 shadow-e1 rounded-xl overflow-hidden"
              >
                <div
                  className="grid grid-cols-[1fr_auto] gap-3 px-4 sm:px-5 py-4 cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : o.orderId)}
                >
                  <div className="min-w-0 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:items-center text-sm">
                    <div>
                      <p className="font-mono text-[11px] text-muted-foreground mb-0.5">
                        {o.orderId?.slice(-8).toUpperCase()}
                      </p>
                      <p className="font-semibold text-foreground line-clamp-1">{o.name || "—"}</p>
                    </div>
                    <p className="text-muted-foreground hidden sm:block font-medium">{o.city || "—"}</p>
                    <p className="font-bold text-foreground">Rs {Number(o.total).toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 w-fit">
                        <AlertTriangle className="size-3" /> Low stock
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest rounded px-2 py-1 border ${o.status === "pre_order_csp" ? "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800" : "text-muted-foreground bg-secondary border-border"}`}>
                        {o.status === "pre_order_csp" ? "Pre-order" : "Main order"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-6 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border bg-secondary/20"
                    >
                      <div className="px-5 py-6 space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">Customer</p>
                            <p className="font-semibold text-foreground">{o.name || "—"}</p>
                            {o.email && <p className="font-mono text-xs text-muted-foreground mt-1">{o.email}</p>}
                          </div>
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">City</p>
                            <p className="font-medium text-foreground">{o.city || "—"}</p>
                          </div>
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">Total</p>
                            <p className="font-bold text-brass text-lg leading-none mt-0.5">Rs {Number(o.total).toLocaleString()}</p>
                          </div>
                        </div>

                        {o.stockIssues?.length > 0 && (
                          <div className="bg-card border border-border rounded-lg p-4">
                            <p className="eyebrow text-muted-foreground mb-3">Stock Issues</p>
                            <div className="space-y-2">
                              {o.stockIssues.map((issue: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <span className="font-medium text-foreground flex items-center gap-2">
                                    <Package className="size-3.5 text-muted-foreground" />
                                    {issue.name}
                                  </span>
                                  <span className="text-red-600 font-bold">
                                    Stock: {issue.currentStock} / Threshold: {issue.threshold}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {o.status === "main_orders" ? (
                          <button
                            onClick={() => removeMut.mutate(o.orderId)}
                            disabled={removeMut.isPending}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {removeMut.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <XCircle className="size-4" />
                            )}
                            {removeMut.isPending ? "Removing…" : "Remove from main_orders & email customer"}
                          </button>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            This pre-order has not been confirmed yet. Notify the customer manually or wait for confirmation.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
