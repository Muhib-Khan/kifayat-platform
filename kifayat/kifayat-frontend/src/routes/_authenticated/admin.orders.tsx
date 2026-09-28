import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminListOrders,
  adminUpdateOrderStatus,
  adminFinalizeOrder,
  adminDownloadCSV,
   adminDownloadPreOrderCSV,
   adminGetPreOrders,
   adminGetCSVQueueCount,
   adminMovePreOrderToCSV,
 } from "@/lib/admin.functions";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Download,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Package,
  FileText,
  Clock,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "./admin.index";
import { PanelTableSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const fmtDate = (v: string) =>
  v
    ? new Date(v).toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function LocationMap({ lat, lng }: { lat: number | null; lng: number | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    if (!mapRef.current || !lat || !lng || mapInst.current) return;

    import("leaflet").then(async ({ default: L }) => {
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current || !lat || !lng) return;

      const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default as string;
      const iconRetinaUrl = (await import("leaflet/dist/images/marker-icon-2x.png")).default as string;
      const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default as string;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng]).addTo(map);
      mapInst.current = map;
    });

    return () => {
      cancelled = true;
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
    };
  }, [lat, lng]);

  if (!lat || !lng) return null;
  return <div ref={mapRef} className="w-full h-36 rounded-lg overflow-hidden border border-border" />;
}

// ── Section: Pre-Orders (confirmed, awaiting CSV download) ──────────────────
function PreOrdersSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: preOrders = [], isLoading } = useQuery({
    queryKey: ["admin", "preorders"],
    queryFn: adminGetPreOrders,
    refetchInterval: 30_000,
  });

  const moveMut = useMutation({
    mutationFn: (id: string) => adminMovePreOrderToCSV(id),
    onSuccess: (res) => {
      toast.success(res.message || "Moved to CSV queue.");
      qc.invalidateQueries({ queryKey: ["admin", "preorders"] });
      qc.invalidateQueries({ queryKey: ["admin", "csv-queue-count"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to move."),
  });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className="size-10 rounded-lg animate-pulse bg-secondary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded animate-pulse bg-secondary" />
              <div className="h-3 w-2/3 rounded animate-pulse bg-secondary" />
            </div>
            <div className="h-6 w-20 rounded-full animate-pulse bg-secondary shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (preOrders.length === 0) {
    return (
      <div className="text-center py-10 bg-card border border-border shadow-e1 rounded-2xl text-muted-foreground flex flex-col items-center">
        <FileText className="size-10 mb-3 text-border" strokeWidth={1} />
        <p className="font-semibold text-foreground text-base">No confirmed orders queued.</p>
        <p className="text-sm mt-1">Confirmed orders will appear here before CSV export.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      className="space-y-3"
    >
      {preOrders.map((o: any) => {
        const isExpanded = expandedId === o.id;
        const items: any[] = o.items ?? [];

        return (
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            key={o.id}
            className="bg-card border border-emerald-200 dark:border-emerald-800 shadow-e1 rounded-xl overflow-hidden"
          >
            <div
              className="grid grid-cols-[1fr_auto] gap-3 px-4 sm:px-5 py-4 cursor-pointer hover:bg-secondary/40 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : o.id)}
            >
              <div className="min-w-0 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-5 sm:gap-4 sm:items-center text-sm">
                <div>
                  <p className="font-mono text-[11px] text-muted-foreground mb-0.5">{o.order_number}</p>
                  <p className="font-semibold text-foreground line-clamp-1">{o.contact_name || "—"}</p>
                </div>
                <p className="text-muted-foreground hidden sm:block font-medium">{o.city || "—"}</p>
                <p className="font-bold text-foreground sm:text-left">Rs {Number(o.total).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground hidden sm:block font-medium">{fmtDate(o.created_at)}</p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1 w-fit">
                  <CheckCircle className="size-3" /> Confirmed
                </span>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                      <div>
                        <p className="eyebrow text-muted-foreground mb-1">Customer</p>
                        <p className="font-semibold text-foreground">{o.contact_name || "—"}</p>
                        {o.contact_phone && (
                          <p className="font-mono text-xs text-muted-foreground mt-1">{o.contact_phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="eyebrow text-muted-foreground mb-1">Location</p>
                        <p className="font-medium text-foreground">{o.city || "—"}</p>
                        {o.address && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.address}</p>
                        )}
                        {o.latitude && o.longitude && (
                          <div className="mt-2 space-y-2">
                            <a
                              href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-brass hover:text-brass/80 transition-colors"
                            >
                              <ExternalLink className="size-3" /> Open in Google Maps
                            </a>
                            <LocationMap lat={o.latitude} lng={o.longitude} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="eyebrow text-muted-foreground mb-1">Courier</p>
                        <p className="font-medium text-foreground">{o.courier || "—"}</p>
                      </div>
                      <div>
                        <p className="eyebrow text-muted-foreground mb-1">Total</p>
                        <p className="font-bold text-brass text-lg leading-none mt-0.5">
                          Rs {Number(o.total).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {o.email && (
                      <p className="text-xs text-muted-foreground font-medium">
                        Confirmation email: <span className="text-foreground">{o.email}</span>
                      </p>
                    )}

                    {items.length > 0 && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="eyebrow text-muted-foreground mb-3">Order Items</p>
                        <div className="space-y-2.5">
                          {items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                              <span className="font-medium text-foreground flex items-center gap-2">
                                <Package className="size-3.5 text-muted-foreground" />
                                {item.name || "—"}
                              </span>
                              <span className="text-muted-foreground font-medium">
                                <span className="text-foreground font-bold mr-1">x{item.quantity}</span>
                                · Rs {Number(item.price).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => moveMut.mutate(o.id)}
                      disabled={moveMut.isPending}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-500 text-white rounded-lg shadow-e1 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      {moveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                      {moveMut.isPending ? "Moving…" : "Move to CSV Queue"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
function AdminOrders() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [preOrderCsvDownloading, setPreOrderCsvDownloading] = useState(false);
  const [finalizedIds, setFinalizedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"pending" | "confirmed">("pending");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: adminListOrders,
  });

  const { data: csvQueueCount = 0 } = useQuery({
    queryKey: ["admin", "csv-queue-count"],
    queryFn: adminGetCSVQueueCount,
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminUpdateOrderStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated.");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const finalizeMut = useMutation({
    mutationFn: (id: string) => adminFinalizeOrder(id),
    onSuccess: (_data, id) => {
      toast.success("Order finalized and added to CSV queue.");
      setFinalizedIds((prev) => new Set([...prev, id]));
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "csv-queue-count"] });
      qc.invalidateQueries({ queryKey: ["admin", "preorders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Finalize failed."),
  });

  const handleDownloadCSV = async () => {
    setCsvDownloading(true);
    try {
      await adminDownloadCSV("");
      toast.success("CSV downloaded successfully.");
      qc.invalidateQueries({ queryKey: ["admin", "csv-queue-count"] });
      qc.invalidateQueries({ queryKey: ["admin", "preorders"] });
    } catch (err: any) {
      toast.error(err?.message ?? "CSV download failed.");
    } finally {
      setCsvDownloading(false);
    }
  };

  const handleDownloadPreOrderCSV = async () => {
    setPreOrderCsvDownloading(true);
    try {
      await adminDownloadPreOrderCSV("");
      toast.success("Pre-order CSV downloaded.");
    } catch (err: any) {
      toast.error(err?.message ?? "Pre-order CSV download failed.");
    } finally {
      setPreOrderCsvDownloading(false);
    }
  };

  if (isLoading) {
    return <PanelTableSkeleton rows={8} cols={4} />;
  }

  const pendingOrders = orders.filter((o: any) => o.status === "pending");

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
            <span className="w-3 h-px bg-brass"></span> All orders
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            Orders<span className="text-brass">.</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 font-medium">
            {orders.length} total ·{" "}
            <span className="text-amber-500 font-bold">{pendingOrders.length} pending</span>
          </p>
        </div>

        {/* CSV download button with live queue badge */}
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={handleDownloadCSV}
            disabled={csvDownloading || csvQueueCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-card shadow-e1 hover:shadow-e2 border border-border rounded-xl text-foreground hover:bg-secondary disabled:opacity-50 transition-all"
          >
            {csvDownloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4 text-brass" />
            )}
            {csvDownloading ? "Downloading…" : "Download Main Order CSV"}
            {csvQueueCount > 0 && !csvDownloading && (
              <span className="ml-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {csvQueueCount}
              </span>
            )}
          </button>
          {csvQueueCount === 0 && (
            <p className="text-xs text-muted-foreground">No orders queued for export</p>
          )}
          {csvQueueCount > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {csvQueueCount} order{csvQueueCount !== 1 ? "s" : ""} ready to export
            </p>
          )}
        </div>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
            tab === "pending"
              ? "bg-card shadow-e1 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="size-3.5" />
            Pending Orders
            {pendingOrders.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {pendingOrders.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setTab("confirmed")}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
            tab === "confirmed"
              ? "bg-card shadow-e1 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle className="size-3.5" />
            CSV Queue
            {csvQueueCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {csvQueueCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Tab: Pending orders */}
      {tab === "pending" && (
        <>
          {orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 bg-card border border-border shadow-e1 rounded-2xl text-muted-foreground flex flex-col items-center"
            >
              <Inbox className="size-12 mb-4 text-border" strokeWidth={1} />
              <p className="font-semibold text-foreground text-lg">No orders found.</p>
              <p className="text-sm mt-1">When customers place orders, they will appear here.</p>
            </motion.div>
          ) : (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
              className="space-y-3"
            >
              {orders.map((o: any) => {
                const isExpanded = expandedId === o.id;
                const isFinalized = finalizedIds.has(o.id);
                const items: any[] = o._raw?.items ?? [];

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
                      <div className="min-w-0 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-5 sm:gap-4 sm:items-center text-sm">
                        {/* Name + order number */}
                        <div>
                          <p className="font-mono text-[11px] text-muted-foreground mb-0.5">
                            {o.order_number}
                          </p>
                          <p className="font-semibold text-foreground line-clamp-1">
                            {o.contact_name || "—"}
                          </p>
                        </div>
                        <p className="text-muted-foreground hidden sm:block font-medium">
                          {o.city || "—"}
                        </p>
                        {/* Mobile sub-line */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
                          <span>{o.city || "—"}</span>
                          {o.created_at && (
                            <>
                              <span>·</span>
                              <span>{fmtDate(o.created_at)}</span>
                            </>
                          )}
                        </div>
                        <p className="font-bold text-foreground sm:text-left">
                          Rs {Number(o.total).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground hidden sm:block font-medium">
                          {fmtDate(o.created_at)}
                        </p>
                        {/* Status select */}
                        <div onClick={(e) => e.stopPropagation()} className="relative">
                          <select
                            value={o.status}
                            onChange={(e) =>
                              update.mutate({ id: o.id, status: e.target.value })
                            }
                            className="appearance-none text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 w-full outline-none cursor-pointer rounded bg-secondary border border-border focus:border-brass transition-colors"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="size-3 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center w-6 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
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
                          <div className="px-5 py-6 space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                              <div>
                                <p className="eyebrow text-muted-foreground mb-1">Customer</p>
                                <p className="font-semibold text-foreground">
                                  {o.contact_name || "—"}
                                </p>
                                {o.contact_phone && (
                                  <p className="font-mono text-xs text-muted-foreground mt-1">
                                    {o.contact_phone}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="eyebrow text-muted-foreground mb-1">Location</p>
                                <p className="font-medium text-foreground">{o.city || "—"}</p>
                                {o.address && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.address}</p>
                                )}
                                {o.latitude && o.longitude && (
                                  <div className="mt-2 space-y-2">
                                    <a
                                      href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-brass hover:text-brass/80 transition-colors"
                                    >
                                      <ExternalLink className="size-3" /> Open in Google Maps
                                    </a>
                                    <LocationMap lat={o.latitude} lng={o.longitude} />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="eyebrow text-muted-foreground mb-1">Payment</p>
                                <p className="font-medium text-foreground capitalize">
                                  {o.payment_method || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="eyebrow text-muted-foreground mb-1">Total</p>
                                <p className="font-bold text-brass text-lg leading-none mt-0.5">
                                  Rs {Number(o.total).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {/* Items */}
                            {items.length > 0 && (
                              <div className="bg-card border border-border rounded-lg p-4">
                                <p className="eyebrow text-muted-foreground mb-3">Order Items</p>
                                <div className="space-y-2.5">
                                  {items.map((item: any, i: number) => (
                                    <div
                                      key={i}
                                      className="flex justify-between items-center text-sm"
                                    >
                                      <span className="font-medium text-foreground flex items-center gap-2">
                                        <Package className="size-3.5 text-muted-foreground" />
                                        {item.name ?? item.product?.name ?? "—"}
                                      </span>
                                      <span className="text-muted-foreground font-medium">
                                        <span className="text-foreground font-bold mr-1">
                                          x{item.quantity ?? item.qty ?? 1}
                                        </span>
                                        · Rs {Number(item.price ?? 0).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Finalize button for pending orders */}
                            <div className="pt-2 flex items-center gap-3">
                              {o.status === "pending" && !isFinalized && (
                                <button
                                  onClick={() => finalizeMut.mutate(o.id)}
                                  disabled={finalizeMut.isPending}
                                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-emerald-500 text-white rounded-lg shadow-e1 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                >
                                  {finalizeMut.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="size-4" />
                                  )}
                                  {finalizeMut.isPending ? "Finalizing…" : "Finalize Order"}
                                </button>
                              )}
                              {isFinalized && (
                                <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
                                  <CheckCircle className="size-4" /> Added to CSV queue
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      {/* Download pre-orders as CSV (always visible, no verification) */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-card border border-border shadow-e1 rounded-xl p-5">
        <div>
          <p className="font-semibold text-foreground">Export Pre Orders</p>
          <p className="text-sm text-muted-foreground">Download all pre-orders (unverified / not yet finalized) as CSV.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadPreOrderCSV}
          disabled={preOrderCsvDownloading}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {preOrderCsvDownloading
            ? <Loader2 className="size-4 animate-spin" />
            : <Download className="size-4" />}
          {preOrderCsvDownloading ? "Downloading…" : "Download Pre Orders CSV"}
        </button>
        </div>
      </div>

      {/* Tab: CSV Queue (confirmed pre-orders) */}
      {tab === "confirmed" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-medium">
            Confirmed pre-orders awaiting fulfilment. Use <strong>"Download Main Order CSV"</strong> above
            to export finalized orders.
          </p>
          <PreOrdersSection />
        </div>
      )}
    </div>
  );
}
