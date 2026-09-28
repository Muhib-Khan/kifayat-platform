import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminListTrackedOrders, adminUpdateTrackedOrderStatus } from "@/lib/admin.functions";
import { toast } from "sonner";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Inbox,
  FileText,
} from "lucide-react";
import { StatusBadge } from "./admin.index";
import { PanelTableSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/order-status")({
  component: AdminOrderStatus,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const fmtDate = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function AdminOrderStatus() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "order-status", page],
    queryFn: () => adminListTrackedOrders({ page, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 1, total: 0 };

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminUpdateTrackedOrderStatus(id, status),
    onSuccess: () => {
      toast.success("Order status updated. The customer will be notified.");
      qc.invalidateQueries({ queryKey: ["admin", "order-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  if (isLoading && orders.length === 0) {
    return <PanelTableSkeleton rows={8} cols={4} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div>
          <p className="eyebrow text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-px bg-brass"></span> Main order tracking
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            Order Status<span className="text-brass">.</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 font-medium">
            {pagination.total} order{pagination.total !== 1 ? "s" : ""} included in the main order
            CSV — update the status and the customer sees it instantly on{" "}
            <span className="text-foreground font-semibold">Your Orders</span>.
          </p>
        </div>
      </motion.div>

      {orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24 bg-card border border-border shadow-e1 rounded-2xl text-muted-foreground flex flex-col items-center"
        >
          <Inbox className="size-12 mb-4 text-border" strokeWidth={1} />
          <p className="font-semibold text-foreground text-lg">No main orders yet.</p>
          <p className="text-sm mt-1 max-w-sm">
            Orders appear here only after you click{" "}
            <span className="font-semibold text-foreground">"Download Main Order CSV"</span> on the
            Orders page. Pending confirmations and pre-orders are not listed here.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.03 } } }}
          className="space-y-3"
        >
          {orders.map((o: any) => {
            const isExpanded = expandedId === o.id;
            const items: any[] = o.products ?? [];
            return (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                key={o.id}
                className="bg-card border border-border shadow-e1 hover:shadow-e2 transition-shadow duration-300 rounded-xl overflow-hidden"
              >
                {/* Row */}
                <div
                  className="grid grid-cols-[1fr_auto] gap-3 px-4 sm:px-5 py-4 cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : o.id)}
                >
                  <div className="min-w-0 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-6 sm:gap-4 sm:items-center text-sm">
                    <div className="sm:col-span-2">
                      <p className="font-mono text-[11px] text-muted-foreground mb-0.5">{o.orderID}</p>
                      <p className="font-semibold text-foreground line-clamp-1">{o.name || "—"}</p>
                    </div>
                    <p className="text-muted-foreground font-medium truncate">{o.city || "—"}</p>
                    <p className="font-bold text-foreground">Rs {Number(o.sellPrice).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground font-medium">{fmtDate(o.exportedAt)}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-6 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border bg-secondary/20"
                    >
                      <div className="px-5 py-6 space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">Customer</p>
                            <p className="font-semibold text-foreground">{o.name || "—"}</p>
                            {o.phone && (
                              <p className="font-mono text-xs text-muted-foreground mt-1">{o.phone}</p>
                            )}
                          </div>
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">Location</p>
                            <p className="font-medium text-foreground">{o.city || "—"}</p>
                            {o.address && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.address}</p>
                            )}
                          </div>
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">Last update</p>
                            <p className="font-medium text-foreground">{fmtDate(o.statusUpdatedAt)}</p>
                          </div>
                          <div>
                            <p className="eyebrow text-muted-foreground mb-1">Total</p>
                            <p className="font-bold text-brass text-lg leading-none mt-0.5">
                              Rs {Number(o.sellPrice).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {items.length > 0 && (
                          <div className="bg-card border border-border rounded-lg p-4">
                            <p className="eyebrow text-muted-foreground mb-3">Order Items</p>
                            <div className="space-y-2.5">
                              {items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <span className="font-medium text-foreground flex items-center gap-2 min-w-0">
                                    <Package className="size-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{item.name || "—"}</span>
                                    {item.variationName && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        · {item.variationName}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-muted-foreground font-medium shrink-0">
                                    <span className="text-foreground font-bold mr-1">x{item.quantity}</span>
                                    · Rs {Number(item.price).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Status control */}
                        <div className="pt-1 flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">Update status:</p>
                          <div className="relative">
                            <select
                              value={o.status}
                              onChange={(e) => update.mutate({ id: o.id, status: e.target.value })}
                              disabled={update.isPending}
                              className="appearance-none text-xs font-bold uppercase tracking-widest px-4 py-2 pr-9 outline-none cursor-pointer rounded-lg bg-coal text-bone focus:outline-none focus:ring-2 focus:ring-brass disabled:opacity-50 transition-colors"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-bone">
                              <ChevronDown className="size-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground font-medium">
                Page {pagination.page} of {pagination.pages} · {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="size-9 grid place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  className="size-9 grid place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Info strip */}
      <div className="flex items-start gap-3 bg-card border border-border shadow-e1 rounded-xl p-5">
        <FileText className="size-5 text-brass shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">How orders reach this section</p>
          <p className="text-muted-foreground mt-1">
            Checkout creates a pending confirmation. Once the customer confirms, the order enters
            the CSV queue. Clicking <strong className="text-foreground">"Download Main Order CSV"</strong> on the
            Orders page exports the queue and archives it here — only then does it appear above, and
            only then can its status be managed. Customers see the updated status on their{" "}
            <strong className="text-foreground">Your Orders</strong> page.
          </p>
        </div>
      </div>
    </div>
  );
}