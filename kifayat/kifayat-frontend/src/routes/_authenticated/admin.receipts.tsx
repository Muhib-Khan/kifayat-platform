import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getAdminReceipts,
  approveReceipt,
  rejectReceipt,
  type ProductReceipt,
} from "@/lib/receipt.functions";

export const Route = createFileRoute("/_authenticated/admin/receipts")({
  component: AdminReceipts,
});

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

function AdminReceipts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-receipts", tab, page],
    queryFn: () =>
      getAdminReceipts({
        status: tab === "all" ? "" : tab,
        page: String(page),
      }),
  });

  const stats = data?.stats ?? [];
  const statMap = Object.fromEntries(stats.map((s: any) => [s._id, s.count]));

  const approveMut = useMutation({
    mutationFn: approveReceipt,
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed."),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectReceipt(id, reason),
    onSuccess: () => {
      toast.success("Receipt rejected.");
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed."),
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-muted-foreground tracking-wide">Admin</p>
        <h1 className="font-display italic text-3xl lg:text-4xl mt-1 font-bold tracking-tight text-foreground">
          Receipts<span className="text-brass">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Review product receipt confirmations from customers.</p>
      </div>

      {/* Tabs + Stats */}
      <div className="flex flex-wrap items-center gap-2 bg-secondary/50 p-1 rounded-xl w-fit max-w-full border border-border">
        {(["pending", "approved", "rejected", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition ${
              tab === t ? "bg-foreground text-background shadow-e1" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pending" && statMap.pending ? `Pending (${statMap.pending})` : t === "approved" && statMap.approved ? `Approved (${statMap.approved})` : t === "rejected" && statMap.rejected ? `Rejected (${statMap.rejected})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: statMap.pending ?? 0, color: "text-amber-600" },
          { label: "Approved", value: statMap.approved ?? 0, color: "text-emerald-600" },
          { label: "Rejected", value: statMap.rejected ?? 0, color: "text-red-600" },
          { label: "Total", value: (statMap.pending ?? 0) + (statMap.approved ?? 0) + (statMap.rejected ?? 0), color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Receipts list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-e1">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : !data?.receipts?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Camera className="size-8 mx-auto mb-3 opacity-30" strokeWidth={1.2} />
            No {tab === "all" ? "" : tab} receipts.
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {data.receipts.map((r: ProductReceipt) => (
                <ReceiptRow
                  key={r._id}
                  receipt={r}
                  onApprove={() => approveMut.mutate(r._id)}
                  onReject={(reason) => rejectMut.mutate({ id: r._id, reason })}
                  isProcessing={approveMut.isPending || rejectMut.isPending}
                />
              ))}
            </div>
            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-t border-border">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`size-8 text-xs font-bold rounded-lg transition ${
                      p === page ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Receipt row ──────────────────────────────────────────────────────────────
function ReceiptRow({
  receipt: r,
  onApprove,
  onReject,
  isProcessing,
}: {
  receipt: ProductReceipt;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isProcessing: boolean;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [showImage, setShowImage] = useState(false);
  const points = Math.floor(r.totalAmount / 300) * 5;

  return (
    <div className="p-4 sm:p-5 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <button
          onClick={() => setShowImage(true)}
          className="size-16 rounded-xl border border-border overflow-hidden shrink-0 hover:ring-2 hover:ring-brass transition-all bg-secondary/30 grid place-items-center"
        >
          <img
            src={r.image}
            alt="Receipt"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-sm">
              {r.user?.name ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">{r.user?.email}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Order: <span className="font-mono">{r.orderId}</span> · {fmtDate(r.createdAt)}
          </div>
          <div className="text-xs mt-1">
            <span className="font-semibold">Rs {r.totalAmount.toLocaleString()}</span>
            <span className="text-muted-foreground"> · {r.items.length} item{r.items.length !== 1 ? "s" : ""}</span>
            <span className="text-brass font-semibold ml-2">+{points} pts</span>
          </div>

          {r.status !== "pending" && (
            <div className="mt-2 text-xs">
              <span className={`inline-flex items-center gap-1 font-medium ${
                r.status === "approved" ? "text-emerald-600" : "text-red-600"
              }`}>
                {r.status === "approved" ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                {r.status === "approved" ? `Approved — ${r.pointsAwarded} pts awarded` : "Rejected"}
              </span>
              {r.reviewNote && (
                <span className="text-muted-foreground ml-2">— {r.reviewNote}</span>
              )}
              {r.reviewedBy && (
                <span className="text-muted-foreground ml-2">by {r.reviewedBy.name}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {r.status === "pending" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="px-3 py-2 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              Approve
            </button>
            <button
              onClick={() => setShowReject(!showReject)}
              disabled={isProcessing}
              className="px-3 py-2 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <XCircle className="size-3.5" />
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Reject reason input */}
      <AnimatePresence>
        {showReject && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 ml-20"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Reason for rejection (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-brass bg-card"
              />
              <button
                onClick={() => { onReject(reason); setShowReject(false); setReason(""); }}
                disabled={isProcessing}
                className="px-3 py-2 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image modal */}
      <AnimatePresence>
        {showImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowImage(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full shadow-e2"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={r.image} alt="Receipt" className="w-full max-h-[70vh] object-contain bg-secondary/20" />
              <div className="p-4 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {r.user?.name} · Rs {r.totalAmount.toLocaleString()} · +{points} pts
                </div>
                <button
                  onClick={() => setShowImage(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
