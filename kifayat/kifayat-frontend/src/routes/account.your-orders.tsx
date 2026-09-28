import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTrackedOrders, cancelTrackedOrder } from "@/lib/shop.functions";
import { getMyReceipts, submitReceipt, type ProductReceipt } from "@/lib/receipt.functions";
import { useAuth } from "@/lib/auth-store";
import { Package, ChevronDown, ChevronUp, Truck, Camera, Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";
import { fmtDatePK, fmtTimePK } from "@/lib/format";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/account/your-orders")({
  component: YourOrders,
});

const tone: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  confirmed: "bg-blue-100 text-blue-900",
  shipped: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

function YourOrders() {
  const { user, loading } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["your-orders"],
    queryFn: listTrackedOrders,
    enabled: !!user,
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["my-receipts"],
    queryFn: getMyReceipts,
    enabled: !!user,
  });

  // Build a map: orderId -> receipt status
  const receiptMap = new Map<string, ProductReceipt>();
  for (const r of receipts) {
    receiptMap.set(r.orderId, r);
  }

  if (loading || isLoading) {
    return (
      <div className="space-y-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="size-14 rounded-lg animate-pulse bg-secondary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded animate-pulse bg-secondary" />
              <div className="h-3 w-2/3 rounded animate-pulse bg-secondary" />
            </div>
            <div className="h-8 w-20 rounded-full animate-pulse bg-secondary shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="border border-border rounded-2xl p-8 text-center">
        <p className="text-muted-foreground mb-4">Sign in to track your orders.</p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 bg-coal text-bone eyebrow px-5 py-3 hover:bg-brass hover:text-coal transition"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border border-border rounded-2xl p-12 text-center">
        <Truck className="size-10 mx-auto mb-4 text-muted-foreground" strokeWidth={1.2} />
        <p className="font-display italic text-2xl">No tracked orders yet.</p>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Once your order is confirmed and included in our main order dispatch, you'll see it here
          with live status updates.
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 mt-6 bg-coal text-bone eyebrow px-5 py-3 hover:bg-brass hover:text-coal transition"
        >
          Browse the edit →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow text-muted-foreground">§ Track your orders</p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
          Your Orders<span className="text-brass">.</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Order status is updated by our team — you'll be notified the moment it changes.
        </p>
      </div>

      {data.map((o) => {
        const isExpanded = expandedId === o.id;
        const receipt = receiptMap.get(o.id);
        const canConfirmReceipt = (o.status === "delivered" || o.status === "shipped") && !receipt;
        return (
          <motion.div
            key={o.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            {/* Row */}
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-secondary/40 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : o.id)}
            >
              <div className="size-12 rounded-xl bg-primary-soft grid place-items-center shrink-0">
                <Package className="size-5 text-primary-dark" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-semibold">{o.order_number}</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tone[o.status] ?? ""}`}
                  >
                    {o.status}
                  </span>
                  {o.stockAlerts.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                      Stock alert
                    </span>
                  )}
                  {receipt && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      receipt.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : receipt.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {receipt.status === "approved" ? "Received ✓" : receipt.status === "rejected" ? "Rejected" : "Receipt pending"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 break-words">
                  {o.date ? `${fmtDatePK(o.date)} · ${fmtTimePK(o.date)}` : "—"} · {o.city || "—"} ·{" "}
                  {o.items.reduce((s, i) => s + i.quantity, 0)} item
                  {o.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
                </div>
              </div>
              <span className="font-display font-bold text-primary-dark shrink-0">
                Rs {Number(o.sellPrice).toLocaleString()}
              </span>
              <span className="text-muted-foreground shrink-0">
                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </span>
            </div>

            {/* Expanded products */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border bg-secondary/20"
                >
                  <div className="px-5 py-5 space-y-4">
                    {o.stockAlerts.length > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/50 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
{o.stockAlerts.length === 1 && o.stockAlerts[0].productName
  ? `"${o.stockAlerts[0].productName}" has been out of stock. You may proceed to enjoy the rest of the shopping experience.`
  : "Some items in this order have been out of stock. You may proceed to enjoy the rest of the shopping experience."}
                      </div>
                    )}
                    {!o.exported && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Your order has been confirmed and is waiting to be dispatched.
                      </p>
                    )}
                    {o.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Product details not available.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {o.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="size-11 rounded-lg object-cover border border-border shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <div className="size-11 rounded-lg bg-primary-soft grid place-items-center shrink-0">
                                <Package className="size-4 text-primary-dark" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground line-clamp-1">{item.name || "—"}</p>
                              {item.variationName && (
                                <p className="text-xs text-muted-foreground">{item.variationName}</p>
                              )}
                            </div>
                            <span className="text-muted-foreground font-medium shrink-0">
                              <span className="text-foreground font-bold mr-1">x{item.quantity}</span>
                              · Rs {Number(item.price).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(o.address || o.phone) && (
                      <div className="text-xs text-muted-foreground border-t border-border pt-3">
                        {o.address && <p className="break-words">Deliver to: {o.address}</p>}
                        {o.phone && <p className="mt-1 font-mono">{o.phone}</p>}
                      </div>
                    )}

                    {/* Receipt section */}
                    <div className="border-t border-border pt-4">
                      {receipt ? (
                        <ReceiptStatus receipt={receipt} />
                      ) : canConfirmReceipt ? (
                        <ReceiptConfirmButton orderId={o.id} orderNumber={o.order_number} />
                      ) : null}
                    </div>

                    {/* Cancel order */}
                    {["pending", "confirmed"].includes(o.status) && (
                      <div className="border-t border-border pt-4">
                        <CancelOrderButton orderId={o.id} orderNumber={o.order_number} />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Cancel order button + confirmation ───────────────────────────────────────
function CancelOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => cancelTrackedOrder(orderId),
    onSuccess: (res) => {
      toast.success(res.message || "Order cancelled.");
      qc.invalidateQueries({ queryKey: ["your-orders"] });
      setConfirming(false);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to cancel order.");
      setConfirming(false);
    },
  });

  if (confirming) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3"
      >
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          Cancel order {orderNumber}?
        </p>
        <p className="text-xs text-red-600 dark:text-red-400">
          This action cannot be undone. Stock and any applied vouchers will be restored.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="px-4 py-2 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {mut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
            {mut.isPending ? "Cancelling…" : "Yes, Cancel Order"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={mut.isPending}
            className="px-4 py-2 text-xs font-bold border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Keep Order
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl transition-colors"
    >
      <Ban className="size-4" />
      Cancel Order
    </button>
  );
}

// ── Receipt status badge ─────────────────────────────────────────────────────
function ReceiptStatus({ receipt }: { receipt: ProductReceipt }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
      receipt.status === "approved"
        ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
        : receipt.status === "rejected"
        ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
        : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
    }`}>
      {receipt.status === "approved" ? (
        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
      ) : receipt.status === "rejected" ? (
        <XCircle className="size-5 text-red-600 shrink-0" />
      ) : (
        <Loader2 className="size-5 text-amber-600 shrink-0 animate-spin" />
      )}
      <div className="flex-1 min-w-0">
        {receipt.status === "approved" ? (
          <p className="font-medium text-emerald-800 dark:text-emerald-200">
            Receipt approved! +{receipt.pointsAwarded} loyalty points earned.
          </p>
        ) : receipt.status === "rejected" ? (
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Receipt rejected.</p>
            {receipt.reviewNote && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Reason: {receipt.reviewNote}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">You can resubmit with a new image.</p>
          </div>
        ) : (
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Receipt under review — points will be awarded on approval.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Receipt confirm button + upload UI ───────────────────────────────────────
function ReceiptConfirmButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-brass text-coal rounded-xl hover:bg-brass/80 transition-colors"
      >
        <Camera className="size-4" />
        Received It
      </button>
      <AnimatePresence>
        {open && (
          <ReceiptUploadPanel orderId={orderId} orderNumber={orderNumber} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Receipt upload panel ─────────────────────────────────────────────────────
function ReceiptUploadPanel({
  orderId,
  orderNumber,
  onClose,
}: {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Please select an image.");
      return submitReceipt(orderId, file);
    },
    onSuccess: (res) => {
      toast.success(res.message || "Receipt submitted!");
      qc.invalidateQueries({ queryKey: ["my-receipts"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit receipt."),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB.");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-e1"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-sm">Confirm Receipt</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload a photo of the product for <span className="font-semibold">{orderNumber}</span>
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition">
          Cancel
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Receipt preview"
            className="w-full max-h-48 object-contain rounded-lg border border-border"
          />
          <button
            onClick={() => { setFile(null); setPreview(null); }}
            className="absolute top-2 right-2 size-7 bg-foreground/80 text-background rounded-full grid place-items-center text-xs font-bold hover:bg-foreground transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl py-8 text-center hover:border-brass hover:bg-brass/5 transition-colors"
        >
          <Camera className="size-8 mx-auto mb-2 text-muted-foreground" strokeWidth={1.2} />
          <p className="text-sm font-medium text-muted-foreground">Tap to upload product photo</p>
          <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG, WebP · Max 10 MB</p>
        </button>
      )}

      <button
        onClick={() => mut.mutate()}
        disabled={!file || mut.isPending}
        className="w-full py-3 text-sm font-bold bg-brass text-coal rounded-xl hover:bg-brass/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {mut.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Camera className="size-4" />
            Submit Receipt
          </>
        )}
      </button>

      <p className="text-[10px] text-muted-foreground text-center">
        5 loyalty points per Rs 300 spent. Admin will review your receipt.
      </p>
    </motion.div>
  );
}
