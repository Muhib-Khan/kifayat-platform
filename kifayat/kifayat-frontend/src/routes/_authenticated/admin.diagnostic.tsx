import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminGetLatestDiagnostic,
  adminResolveDiagnostic,
  adminRunDiagnostic,
  adminSetDiagnosticPrice,
} from "@/lib/admin.functions";
import { motion } from "framer-motion";
import { AlertTriangle, Play, CheckCircle, Search, Edit2, Loader2, RefreshCw, Box, Check, CheckSquare, X } from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/diagnostic")({
  component: DiagnosticPage,
});

const fmtFull = (v: string) => v ? new Date(v).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function DiagnosticPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-diagnostic"],
    queryFn: adminGetLatestDiagnostic,
  });

  const diagnostic = data?.diagnostic ?? null;
  const pendingIssues = diagnostic?.issues?.filter((i: any) => i.status === "pending") ?? [];
  const fixedIssues = diagnostic?.issues?.filter((i: any) => i.status === "fixed") ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-diagnostic"] });

  const runMut = useMutation({
    mutationFn: adminRunDiagnostic,
    onSuccess: (res) => { setMsg({ type: "success", text: `Diagnostic complete. Found ${res.totalIssues} issue(s).` }); invalidate(); },
    onError: (err: any) => setMsg({ type: "error", text: err.message || "Failed to run diagnostic." }),
  });

  const setPriceMut = useMutation({
    mutationFn: ({ diagnosticId, productId, retailPrice }: { diagnosticId: string; productId: string; retailPrice: number }) =>
      adminSetDiagnosticPrice(diagnosticId, productId, retailPrice),
    onSuccess: (res) => { setMsg({ type: "success", text: res.message }); setEditingId(null); setEditPrice(""); invalidate(); },
    onError: (err: any) => setMsg({ type: "error", text: err.message || "Failed to set price." }),
  });

  const resolveMut = useMutation({
    mutationFn: () => adminResolveDiagnostic(diagnostic._id),
    onSuccess: (res) => { setMsg({ type: "success", text: res.message }); invalidate(); },
    onError: (err: any) => setMsg({ type: "error", text: err.message || "Failed to resolve." }),
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <p className="eyebrow text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-px bg-brass"></span> System Health
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            Price Diagnostic<span className="text-brass">.</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 font-medium">Identify and fix products missing retail prices.</p>
        </div>
        <div className="flex gap-3">
          {diagnostic && pendingIssues.length === 0 && diagnostic.status !== "resolved" && (
            <button
              onClick={() => resolveMut.mutate()}
              disabled={resolveMut.isPending}
              className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 rounded-xl hover:bg-emerald-500/20 disabled:opacity-50 transition-colors shadow-sm"
            >
              {resolveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckSquare className="size-4" />} Verify Fixes
            </button>
          )}
          <button
            onClick={() => { setMsg(null); runMut.mutate(); }}
            disabled={runMut.isPending}
            className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1"
          >
            {runMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} 
            {runMut.isPending ? "Scanning…" : "Run Diagnostic"}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`px-5 py-4 rounded-xl text-sm font-bold border flex items-center gap-3 ${msg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600"}`}>
          {msg.type === "success" ? <CheckCircle className="size-5" /> : <AlertTriangle className="size-5" />}
          {msg.text}
        </motion.div>
      )}

      {/* Status bar */}
      {diagnostic && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border shadow-e1 rounded-xl p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <p className="eyebrow text-muted-foreground mb-1.5">Status</p>
            <p className="font-bold text-foreground flex items-center gap-1.5">
              {diagnostic.status === "resolved" ? <span className="text-emerald-500 flex items-center gap-1.5"><CheckCircle className="size-4" /> Resolved</span> 
                : diagnostic.status === "acknowledged" ? <span className="text-blue-500 flex items-center gap-1.5"><Search className="size-4" /> Acknowledged</span> 
                : diagnostic.status === "auto_applied" ? <span className="text-amber-500 flex items-center gap-1.5"><RefreshCw className="size-4" /> Auto-Applied</span> 
                : <span className="text-red-500 flex items-center gap-1.5"><AlertTriangle className="size-4" /> Pending Fix</span>}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="eyebrow text-muted-foreground mb-1.5">Last Scan</p>
            <p className="font-bold text-foreground">{fmtFull(diagnostic.runAt)}</p>
          </div>
          <div>
            <p className="eyebrow text-muted-foreground mb-1.5">Issues Found</p>
            <p className={`font-display text-2xl font-bold leading-none ${pendingIssues.length > 0 ? "text-red-500" : "text-emerald-500"}`}>{pendingIssues.length}</p>
          </div>
          <div>
            <p className="eyebrow text-muted-foreground mb-1.5">Fixed</p>
            <p className="font-display text-2xl font-bold leading-none text-emerald-500">{fixedIssues.length}</p>
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <PageSkeleton rows={6} />
      )}

      {/* No issues */}
      {!isLoading && diagnostic && pendingIssues.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card shadow-e1 border border-border rounded-2xl flex flex-col items-center">
          <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
            <Check className="size-8 text-emerald-500" strokeWidth={3} />
          </div>
          <p className="font-display text-2xl font-bold text-emerald-600 tracking-tight">System is healthy.</p>
          <p className="text-muted-foreground font-medium mt-2">All products in the database have valid retail prices set.</p>
        </motion.div>
      )}

      {/* No diagnostic yet */}
      {!isLoading && !diagnostic && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card shadow-e1 border border-border rounded-2xl flex flex-col items-center text-muted-foreground">
          <Search className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">No scans history found.</p>
          <p className="text-sm mt-1">Run a diagnostic to scan the database for missing prices.</p>
        </motion.div>
      )}

      {/* Pending issues table */}
      {!isLoading && pendingIssues.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h3 className="font-display font-bold text-xl text-red-500 flex items-center gap-2">
            <AlertTriangle className="size-5" /> Action Required: {pendingIssues.length} Missing Prices
          </h3>
          <div className="bg-card border border-border shadow-e1 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 eyebrow text-muted-foreground">
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold text-right">Wholesale</th>
                    <th className="px-6 py-4 font-semibold text-right">Retail Price</th>
                    <th className="px-6 py-4 font-semibold text-center w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingIssues.map((issue: any) => (
                    <tr key={issue.productId} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <Box className="size-4 text-muted-foreground" /> {issue.productName}
                        </div>
                        {issue.productSku && <div className="text-[11px] font-mono text-muted-foreground mt-1 ml-6">{issue.productSku}</div>}
                      </td>
                      <td className="px-6 py-4 font-medium text-muted-foreground">{issue.category}</td>
                      <td className="px-6 py-4 text-right font-medium text-foreground">PKR {issue.wholesalePrice?.toLocaleString("en-PK")}</td>
                      <td className="px-6 py-4 text-right">
                        {editingId === issue.productId ? (
                          <input
                            type="number" min="0" value={editPrice} autoFocus
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-28 bg-background border border-brass rounded-lg px-3 py-2 text-right text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-brass shadow-sm"
                            placeholder="Amount"
                          />
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded bg-red-500/10 text-red-600 font-bold text-[10px] uppercase tracking-widest border border-red-500/20">Not Set</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === issue.productId ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => setPriceMut.mutate({ diagnosticId: diagnostic._id, productId: issue.productId, retailPrice: Number(editPrice) })}
                              disabled={!editPrice || setPriceMut.isPending}
                              className="size-8 flex items-center justify-center bg-coal text-bone rounded-lg disabled:opacity-50 transition-colors shadow-sm hover:bg-coal/90" title="Save">
                              {setPriceMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={3} />}
                            </button>
                            <button onClick={() => { setEditingId(null); setEditPrice(""); }}
                              className="size-8 flex items-center justify-center border border-border text-muted-foreground rounded-lg hover:bg-secondary transition-colors" title="Cancel">
                              <X className="size-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <button onClick={() => { setEditingId(issue.productId); setEditPrice(""); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-border bg-card text-foreground rounded-lg hover:bg-secondary hover:border-brass transition-colors shadow-sm">
                              <Edit2 className="size-3.5" /> Set Price
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Fixed issues block */}
      {!isLoading && fixedIssues.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 border-t border-border">
          <details className="group bg-secondary/30 border border-border rounded-xl overflow-hidden marker:hidden">
            <summary className="px-6 py-4 text-sm font-bold text-emerald-600 cursor-pointer hover:bg-secondary/50 transition-colors flex items-center gap-2 select-none">
              <CheckCircle className="size-4" /> {fixedIssues.length} Resolved issues in this scan
            </summary>
            <div className="overflow-x-auto border-t border-border bg-card">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 eyebrow text-muted-foreground">
                    <th className="px-6 py-3 font-semibold">Product</th>
                    <th className="px-6 py-3 font-semibold">SKU</th>
                    <th className="px-6 py-3 font-semibold text-right">Fixed Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fixedIssues.map((issue: any) => (
                    <tr key={issue.productId}>
                      <td className="px-6 py-3 font-bold text-foreground flex items-center gap-2">
                        <Box className="size-3.5 text-emerald-500" /> {issue.productName}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{issue.productSku ?? "—"}</td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-600">PKR {issue.retailPrice?.toLocaleString("en-PK") ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          
          {pendingIssues.length > 0 && (
            <div className="mt-6 flex justify-end">
              <button onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending}
                className="flex items-center gap-2 px-6 py-3 text-sm font-bold border border-border bg-card text-foreground rounded-xl hover:bg-secondary disabled:opacity-50 transition-colors shadow-sm">
                <RefreshCw className={`size-4 ${resolveMut.isPending ? "animate-spin" : ""}`} /> Re-check &amp; Resolve Rest
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
