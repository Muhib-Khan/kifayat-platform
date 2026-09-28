import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Ticket, Coins, Percent, Loader2, CheckCircle, Star, Gift, Search, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import {
  getAvailableVouchers,
  getMyVouchers,
  buyVoucher,
  applyVoucherToProduct,
  type DiscountVoucher,
  type PurchasedVoucher,
  type PurchasedVoucherStatus,
  type AppliedProduct,
} from "@/lib/voucher.functions";
import { listProducts } from "@/lib/shop.functions";
import { type UIProduct } from "@/lib/api";
import { getMyProfile } from "@/lib/shop.functions";
import { refreshAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/account/vouchers")({
  component: AccountVouchers,
});

const STATUS_META: Record<PurchasedVoucherStatus, { label: string; cls: string }> = {
  Available: { label: "Available", cls: "text-emerald-600 border-emerald-500/20 bg-emerald-500/10" },
  Applied: { label: "Applied", cls: "text-amber-600 border-amber-500/20 bg-amber-500/10" },
  "Used Up": { label: "Used Up", cls: "text-muted-foreground border-border bg-secondary/30" },
  Expired: { label: "Expired", cls: "text-red-600 border-red-500/20 bg-red-500/10" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function appliedName(a: AppliedProduct) {
  if (typeof a.product === "object" && a.product?.name) return a.product.name;
  return a.slug || a.product?.toString() || "Product";
}

function productIdOf(p: string | { _id: string; name: string; slug: string } | null): string {
  if (!p) return "";
  return typeof p === "object" ? p._id : p;
}

function giftedProductName(p: string | { _id: string; name: string; slug: string } | null): string {
  if (typeof p === "string") return p || "Product";
  return p?.name || "Product";
}

function AccountVouchers() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [usingId, setUsingId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const available = useQuery({ queryKey: ["vouchers-available"], queryFn: getAvailableVouchers });
  const mine = useQuery({ queryKey: ["vouchers-mine"], queryFn: getMyVouchers });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const pickerResults = useQuery({
    queryKey: ["voucher-use-picker", pickerQuery],
    queryFn: async () => {
      if (!pickerQuery.trim()) return [];
      return listProducts({ search: pickerQuery.trim(), limit: 8 }).then((r) => r.products);
    },
    enabled: pickerFor !== null && pickerQuery.trim().length > 1,
    placeholderData: (prev: UIProduct[] | undefined) => prev ?? [],
  });

  const buyMut = useMutation({
    mutationFn: buyVoucher,
    onSuccess: (data) => {
      toast.success(`Voucher purchased! ${data.remainingPoints} points remaining.`);
      qc.invalidateQueries({ queryKey: ["vouchers-available"] });
      qc.invalidateQueries({ queryKey: ["vouchers-mine"] });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      refreshAuth();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function alreadyApplied(pv: PurchasedVoucher, productId: string): boolean {
    return (pv.applied_products ?? []).some(
      (a) => productIdOf(a.product) === productId,
    );
  }

  async function applyGiftTo(pv: PurchasedVoucher, productId: string) {
    if (alreadyApplied(pv, productId)) return;
    await applyVoucherToProduct(pv._id, productId);
  }

  async function handleUse(pv: PurchasedVoucher) {
    if (usingId) return;
    setUsingId(pv._id);
    try {
      const targets = (pv.products ?? []).map(productIdOf).filter(Boolean);
      if (targets.length === 0) {
        setPickerFor(pv._id);
        return;
      }
      let applied = 0;
      for (const pid of targets) {
        try {
          await applyGiftTo(pv, pid);
          applied++;
        } catch {
          // already applied or rule violation — move on
        }
      }
      qc.invalidateQueries({ queryKey: ["vouchers-mine"] });
      if (applied > 0) {
        toast.success(`Voucher applied to ${applied} product${applied > 1 ? "s" : ""} — add them to your bag.`);
      } else {
        toast.info("This voucher is already applied to its products.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not apply voucher.");
    } finally {
      setUsingId(null);
    }
  }

  async function handleUseOnPicked(pv: PurchasedVoucher, productId: string, productName: string) {
    if (usingId) return;
    if (alreadyApplied(pv, productId)) {
      toast.info("Voucher already applied to this product.");
      setPickerFor(null);
      setPickerQuery("");
      return;
    }
    setUsingId(pv._id);
    try {
      await applyVoucherToProduct(pv._id, productId);
      qc.invalidateQueries({ queryKey: ["vouchers-mine"] });
      setPickerFor(null);
      setPickerQuery("");
      toast.success(`Voucher applied to ${productName} — add it to your bag.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not apply voucher.");
    } finally {
      setUsingId(null);
    }
  }

  const isLoading = available.isLoading || mine.isLoading;

  return (
    <div className="space-y-8 pb-16">
      <div>
        <p className="eyebrow text-muted-foreground">§ Discounts</p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
          Vouchers<span className="text-brass">.</span>
        </h2>
      </div>

      {/* Points & Multiplier Card */}
      <div className="bg-gradient-to-r from-coal to-coal/90 text-bone rounded-2xl p-6 shadow-e1 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Coins className="size-7 text-amber-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-bone/50 font-semibold">Loyalty Points</p>
            <p className="font-display italic text-4xl mt-1">
              {profile.isLoading
                ? "…"
                : (profile.data?.profile?.loyaltyPoints ?? available.data?.userPoints ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-bone/50 mt-1">Earn points on every order — spend them on vouchers below.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-brass/10 border border-brass/25 flex items-center justify-center shrink-0">
            <Star className="size-7 text-brass" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-bone/50 font-semibold">Tier</p>
            <p className="font-display italic text-3xl mt-1 capitalize">
              {profile.data?.profile?.tier ?? "—"}
            </p>
            <p className="text-xs text-bone/50 mt-1">Your exclusive member tier.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl w-fit border border-border">
        {(["available", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition ${
              tab === t ? "bg-foreground text-background shadow-e1" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "available" ? "Available" : "Your Vouchers"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 sm:p-6 flex items-center gap-4">
              <div className="size-14 rounded-2xl animate-pulse bg-secondary shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded animate-pulse bg-secondary" />
                <div className="h-3 w-2/3 rounded animate-pulse bg-secondary" />
              </div>
              <div className="h-9 w-28 rounded-full animate-pulse bg-secondary shrink-0" />
            </div>
          ))}
        </div>
      ) : tab === "available" ? (
        <>
          {available.data?.vouchers.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-coal/15 rounded-2xl">
              <Ticket className="size-10 mx-auto text-coal/30 mb-4" strokeWidth={1.2} />
              <p className="text-muted-foreground mb-2 font-medium">No vouchers available</p>
              <p className="text-xs text-muted-foreground">Check back later for new discounts.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {available.data?.vouchers.map((v: DiscountVoucher, i: number) => (
                <motion.div key={v._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-5 sm:p-6 hover:shadow-lg hover:shadow-black/5 transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="size-14 rounded-2xl bg-brass/10 border border-brass/20 flex items-center justify-center shrink-0"
                        style={{ background: "rgba(201,161,74,0.1)", border: "1px solid rgba(201,161,74,0.2)" }}
                      >
                        <Percent className="size-6 text-brass" strokeWidth={1.8} />
                      </div>
                      <div>
                        <p className="font-display font-bold text-2xl tracking-tight text-foreground">
                          {v.discount_percent}% OFF
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{v.voucher_code}</p>
                        {v.expires_at && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Expires {new Date(v.expires_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                          <Coins className="size-3.5" /> {v.points_required} pts
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">required</p>
                      </div>
                      <button onClick={() => buyMut.mutate(v._id)}
                        disabled={buyMut.isPending || (available.data?.userPoints ?? 0) < v.points_required}
                        className="h-11 px-6 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 shrink-0"
                      >
                        {buyMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
                        {buyMut.isPending ? "Buying…" : "Buy"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {mine.data?.vouchers.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-coal/15 rounded-2xl">
              <CheckCircle className="size-10 mx-auto text-coal/30 mb-4" strokeWidth={1.2} />
              <p className="text-muted-foreground mb-2 font-medium">No vouchers yet</p>
              <p className="text-xs text-muted-foreground">Browse available vouchers or keep an eye on your email for gifts.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {mine.data?.vouchers.map((pv: PurchasedVoucher, i: number) => {
                const sm = STATUS_META[pv.status] ?? STATUS_META.Available;
                const reserved = (pv.applied_products ?? []).filter((a) => a.status === "reserved");
                const isGift = pv.source === "gifted";
                const giftProducts = (pv.products ?? []).filter((p) => p !== null);
                const useable = pv.status === "Available" || pv.status === "Applied";
                const showUse = isGift && useable;
                return (
                  <motion.div key={pv._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border rounded-2xl p-5 hover:shadow-lg hover:shadow-black/5 transition-all duration-300 flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display font-bold text-3xl tracking-tight text-foreground">
                          {pv.discount_percent}% OFF
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {pv.voucher?.voucher_code ?? pv.voucher_code ?? (isGift ? "Gift" : "Deleted")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {isGift && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border text-brass border-brass/30 bg-brass/10">
                            <Gift className="size-3" /> Gifted
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border shrink-0 ${sm.cls}`}>
                          {sm.label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-secondary/40 border border-border p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {isGift ? "Received" : "Purchased"}
                        </p>
                        <p className="font-semibold text-foreground mt-0.5">{fmtDate(pv.gifted_at ?? pv.purchased_at)}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 border border-border p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Expires</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {pv.expires_at ? fmtDate(pv.expires_at) : "Never"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 border border-border p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Uses</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {pv.consumed_count} used · {pv.remaining_uses} left
                          <span className="text-muted-foreground font-normal"> / {pv.total_uses}</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 border border-border p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {isGift ? "From" : "Points Spent"}
                        </p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {isGift ? (pv.gifted_by?.name || "Kifayat") : `${pv.points_spent} pts`}
                        </p>
                      </div>
                    </div>

                    {isGift && giftProducts.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                          Valid on
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {giftProducts.map((p) => (
                            <span key={productIdOf(p)}
                              className="text-[11px] font-medium text-foreground bg-secondary/60 border border-border rounded-full px-2.5 py-1"
                            >
                              {giftedProductName(p)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {showUse && (
                      <>
                        <button onClick={() => handleUse(pv)} disabled={usingId !== null}
                          className="h-10 w-full rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {usingId === pv._id ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
                          {usingId === pv._id ? "Applying…" : "Use Voucher"}
                        </button>
                        {pickerFor === pv._id && (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)}
                                autoFocus placeholder="Search a product to apply this gift…"
                                className="w-full h-11 pl-10 pr-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all"
                              />
                            </div>
                            {pickerResults.data && pickerResults.data.length > 0 && (
                              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                {pickerResults.data.map((p: UIProduct) => (
                                  <button key={p.id} disabled={usingId !== null}
                                    onClick={() => handleUseOnPicked(pv, p.id, p.name)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-secondary/60 transition text-sm flex items-center gap-2 disabled:opacity-50"
                                  >
                                    <PackageSearch className="size-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium text-foreground truncate">{p.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {reserved.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Applied to</p>
                        <div className="flex flex-wrap gap-1.5">
                          {reserved.map((a) => (
                            <span key={a.product?.toString() + a.slug}
                              className="text-[11px] font-medium text-foreground bg-secondary/60 border border-border rounded-full px-2.5 py-1"
                            >
                              {appliedName(a)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
