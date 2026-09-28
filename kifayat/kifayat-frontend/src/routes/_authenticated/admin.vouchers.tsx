import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, Ticket, RefreshCw, Percent, Coins, Calendar, Hash } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  generateVoucher,
  getAdminVouchers,
  getAdminPurchasedVouchers,
  deleteVoucher,
  getCompensationVouchers,
  type DiscountVoucher,
  type PurchasedVoucher,
  type CompensationVoucher,
} from "@/lib/voucher.functions";

export const Route = createFileRoute("/_authenticated/admin/vouchers")({
  component: AdminVouchers,
});

function fmtDate(v: string) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AdminVouchers() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "purchased" | "compensation">("active");
  const [purchasedPage, setPurchasedPage] = useState(1);
  const [compPage, setCompPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [discountPct, setDiscountPct] = useState("");
  const [pointsReq, setPointsReq] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const vouchers = useQuery({ queryKey: ["admin-vouchers"], queryFn: getAdminVouchers });
  const purchased = useQuery({
    queryKey: ["admin-purchased-vouchers", purchasedPage],
    queryFn: () => getAdminPurchasedVouchers(purchasedPage),
  });

  const compensation = useQuery({
    queryKey: ["admin-compensation-vouchers", compPage],
    queryFn: () => getCompensationVouchers({ page: String(compPage) }),
  });

  const genMut = useMutation({
    mutationFn: generateVoucher,
    onSuccess: () => {
      toast.success("Voucher generated");
      setShowCreate(false);
      setDiscountPct(""); setPointsReq(""); setMaxUses(""); setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: deleteVoucher,
    onSuccess: () => {
      toast.success("Voucher deleted");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-muted-foreground tracking-wide">Admin</p>
        <h1 className="font-display italic text-3xl lg:text-4xl mt-1 font-bold tracking-tight text-foreground">
          Vouchers<span className="text-brass">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Manage discount vouchers and view redemptions.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-secondary/50 p-1 rounded-xl w-fit max-w-full border border-border">
        {(["active", "purchased", "compensation"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowCreate(false); }}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition ${
              tab === t ? "bg-foreground text-background shadow-e1" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "active" ? "Active Vouchers" : t === "purchased" ? "Redemption History" : "Compensation"}
          </button>
        ))}
        {tab === "active" && !showCreate && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-semibold text-brass hover:bg-brass/10 rounded-lg transition flex items-center gap-2"
          >
            <Plus className="size-4" /> Generate
          </button>
        )}
      </div>

      {tab === "active" && (
        <>
          {/* Generate Form */}
          {showCreate && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-e1"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg tracking-tight">New Voucher</h3>
                <button onClick={() => setShowCreate(false)} className="text-sm text-muted-foreground hover:text-foreground transition">Cancel</button>
              </div>
              <div className="grid sm:grid-cols-4 gap-4">
                <label className="block">
                  <span className="text-xs text-muted-foreground mb-1.5 block font-medium flex items-center gap-1.5">
                    <Percent className="size-3" /> Discount %
                  </span>
                  <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
                    min={1} max={100} placeholder="e.g. 10"
                    className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground mb-1.5 block font-medium flex items-center gap-1.5">
                    <Coins className="size-3" /> Points Required
                  </span>
                  <input type="number" value={pointsReq} onChange={(e) => setPointsReq(e.target.value)}
                    min={1} placeholder="e.g. 100"
                    className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground mb-1.5 block font-medium flex items-center gap-1.5">
                    <Hash className="size-3" /> Max Uses
                  </span>
                  <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                    min={1} placeholder="Unlimited"
                    className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground mb-1.5 block font-medium flex items-center gap-1.5">
                    <Calendar className="size-3" /> Expires At
                  </span>
                  <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
                </label>
              </div>
              <button onClick={() => {
                const discount_percent = parseInt(discountPct);
                const points_required = parseInt(pointsReq);
                if (!discount_percent || discount_percent < 1 || discount_percent > 100) { toast.error("Enter a valid discount % (1-100)"); return; }
                if (!points_required || points_required < 1) { toast.error("Enter points required"); return; }
                genMut.mutate({ discount_percent, points_required, max_uses: maxUses ? parseInt(maxUses) : undefined, expires_at: expiresAt || undefined });
              }} disabled={genMut.isPending}
                className="h-11 px-6 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {genMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
                {genMut.isPending ? "Generating…" : "Generate Voucher"}
              </button>
            </motion.div>
          )}

          {/* Active Vouchers */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-e1">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg tracking-tight">Active Vouchers</h3>
                <p className="eyebrow text-[10px] text-muted-foreground mt-0.5">
                  {vouchers.data?.vouchers.filter((v) => v.status !== "Purchased").length ?? 0} active · {vouchers.data?.vouchers.filter((v) => v.status === "Purchased").length ?? 0} purchased
                </p>
              </div>
              <button onClick={() => vouchers.refetch()} disabled={vouchers.isFetching}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg text-sm font-semibold hover:bg-secondary transition disabled:opacity-50"
              >
                <RefreshCw className={`size-4 ${vouchers.isFetching ? "animate-spin text-brass" : "text-muted-foreground"}`} />
                Refresh
              </button>
            </div>
            {vouchers.isLoading ? (
              <div className="divide-y divide-border" aria-hidden>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-6 w-10 rounded-full ml-auto" />
                  </div>
                ))}
              </div>
            ) : !vouchers.data?.vouchers.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Ticket className="size-8 mx-auto mb-3 opacity-30" strokeWidth={1.2} />
                No vouchers yet. Click "Generate" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border eyebrow text-muted-foreground">
                      <th className="p-4 font-medium">Code</th>
                      <th className="p-4 font-medium">Discount</th>
                      <th className="p-4 font-medium">Points</th>
                      <th className="p-4 font-medium">Max Uses</th>
                      <th className="p-4 font-medium">Expires</th>
                      <th className="p-4 font-medium">Created</th>
                      <th className="p-4 font-medium">Purchased By</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vouchers.data.vouchers.map((v: DiscountVoucher) => (
                      <tr key={v._id} className="hover:bg-secondary/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-foreground text-xs">{v.voucher_code}</td>
                        <td className="p-4 font-semibold text-foreground">{v.discount_percent}%</td>
                        <td className="p-4 text-muted-foreground">{v.points_required}</td>
                        <td className="p-4 text-muted-foreground">{v.max_uses ?? "∞"}</td>
                        <td className="p-4 text-muted-foreground text-xs">{v.expires_at ? fmtDate(v.expires_at) : "—"}</td>
                        <td className="p-4 text-muted-foreground text-xs">{fmtDate(v.created_at)}</td>
                        <td className="p-4">
                          {v.status === "Purchased" && v.purchased_by ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border text-brass border-brass/30 bg-brass/10">
                                Purchased
                              </span>
                              <span className="text-xs text-muted-foreground block mt-1">{v.purchased_by.email}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button onClick={() => { if (confirm("Delete this voucher?")) delMut.mutate(v._id); }}
                              disabled={delMut.isPending}
                              className="size-8 grid place-items-center text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                            >
                              <Trash2 className="size-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "purchased" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-e1">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg tracking-tight">Redemption History</h3>
              <p className="eyebrow text-[10px] text-muted-foreground mt-0.5">{purchased.data?.total ?? 0} total redemptions</p>
            </div>
            <button onClick={() => purchased.refetch()} disabled={purchased.isFetching}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg text-sm font-semibold hover:bg-secondary transition disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${purchased.isFetching ? "animate-spin text-brass" : "text-muted-foreground"}`} />
              Refresh
            </button>
          </div>
          {purchased.isLoading ? (
            <div className="divide-y divide-border" aria-hidden>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-14" />
                  <Skeleton className="h-3.5 w-14" />
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : !purchased.data?.vouchers.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Ticket className="size-8 mx-auto mb-3 opacity-30" strokeWidth={1.2} />
              No redemptions yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border eyebrow text-muted-foreground">
                      <th className="p-4 font-medium">User</th>
                      <th className="p-4 font-medium">Voucher</th>
                      <th className="p-4 font-medium">Discount</th>
                      <th className="p-4 font-medium">Points Spent</th>
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {purchased.data.vouchers.map((pv: PurchasedVoucher) => (
                      <tr key={pv._id} className="hover:bg-secondary/40 transition-colors">
                        <td className="p-4">
                          <span className="font-medium text-foreground">{pv.user?.name ?? "—"}</span>
                          <span className="text-xs text-muted-foreground block">{pv.user?.email}</span>
                        </td>
                        <td className="p-4 font-mono text-xs text-foreground">{pv.voucher?.voucher_code ?? "Deleted"}</td>
                        <td className="p-4 font-semibold text-foreground">{pv.discount_percent}%</td>
                        <td className="p-4 text-muted-foreground">{pv.points_spent}</td>
                        <td className="p-4 text-muted-foreground text-xs">{fmtDate(pv.purchased_at)}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border ${
                            pv.used ? "text-emerald-600 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground border-border bg-secondary/30"
                          }`}>
                            {pv.used ? "Used" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {purchased.data.pages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-t border-border">
                  {Array.from({ length: purchased.data.pages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPurchasedPage(p)}
                      className={`size-8 text-xs font-bold rounded-lg transition ${
                        p === purchasedPage ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
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
      )}

      {tab === "compensation" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-e1">
          <div className="p-5 border-b border-border">
            <h3 className="font-display font-bold text-lg tracking-tight">Compensation Vouchers</h3>
            <p className="text-xs text-muted-foreground mt-1">Auto-generated when orders are cancelled.</p>
          </div>
          {compensation.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : !compensation.data?.vouchers?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Ticket className="size-8 mx-auto mb-3 opacity-30" strokeWidth={1.2} />
              No compensation vouchers yet.
            </div>
          ) : (
            <>
              {/* Stats */}
              {compensation.data.stats?.length > 0 && (
                <div className="flex gap-4 p-4 border-b border-border bg-secondary/20">
                  {compensation.data.stats.map((s: any) => (
                    <div key={String(s._id)} className="text-center">
                      <p className="text-lg font-bold text-foreground">{s.count}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s._id ? "Used" : "Unused"}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border eyebrow text-muted-foreground">
                      <th className="p-4 font-medium">User</th>
                      <th className="p-4 font-medium">Type</th>
                      <th className="p-4 font-medium">Discount</th>
                      <th className="p-4 font-medium">Products</th>
                      <th className="p-4 font-medium">Generated</th>
                      <th className="p-4 font-medium">Expires</th>
                      <th className="p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {compensation.data.vouchers.map((cv: CompensationVoucher) => (
                      <tr key={cv._id} className="hover:bg-secondary/40 transition-colors">
                        <td className="p-4">
                          <span className="font-medium text-foreground">{cv.user?.name ?? "—"}</span>
                          <span className="text-xs text-muted-foreground block">{cv.user?.email}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary/50 text-foreground">
                            {cv.voucher_type === "discount_all" ? "All Products" : cv.voucher_type === "discount_specific" ? "Specific" : "Free Product"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-foreground">{cv.discount_percent ? `${cv.discount_percent}%` : "—"}</td>
                        <td className="p-4 text-muted-foreground text-xs">
                          {Array.isArray(cv.products) && cv.products.length > 0
                            ? cv.products.map((p: any) => p.name ?? p).join(", ")
                            : "—"}
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{fmtDate(cv.generated_at)}</td>
                        <td className="p-4 text-muted-foreground text-xs">{fmtDate(cv.expires_at)}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border ${
                            cv.used ? "text-emerald-600 border-emerald-500/20 bg-emerald-500/10" : "text-amber-600 border-amber-500/20 bg-amber-500/10"
                          }`}>
                            {cv.used ? "Used" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {compensation.data.pages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-t border-border">
                  {Array.from({ length: compensation.data.pages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setCompPage(p)}
                      className={`size-8 text-xs font-bold rounded-lg transition ${
                        p === compPage ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
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
      )}
    </div>
  );
}
