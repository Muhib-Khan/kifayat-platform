import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FolderSync,
  Loader2,
  MessageSquareHeart,
  Play,
  RefreshCw,
  ScanSearch,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Type,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  aiFindDuplicates,
  aiAnalyzeReviews,
  aiGetDescriptionDoctorStatus,
  aiGetTitleOptimizerStatus,
  aiHideProduct,
  aiStartDescriptionDoctor,
  aiStartTitleOptimizer,
  aiStartSeoBooster,
  aiGetSeoBoosterStatus,
  aiAnalyzePricing,
  aiStartCategoryFixer,
  aiGetCategoryFixerStatus,
  aiGetPoolStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  component: AIStudioPage,
});

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const LOG_COLORS: Record<string, string> = {
  info:     "text-muted-foreground",
  progress: "text-foreground",
  warn:     "text-amber-600",
  error:    "text-red-600",
  done:     "text-emerald-600 font-medium",
};

function LogBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    info:     "bg-secondary text-muted-foreground",
    progress: "bg-blue-50 text-blue-700",
    warn:     "bg-amber-50 text-amber-700",
    error:    "bg-red-50 text-red-700",
    done:     "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide ${map[type] ?? map.info}`}>
      {type}
    </span>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
      <motion.div className="h-full bg-brass rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
    </div>
  );
}

function JobLogs({ logs, maxVisible = 6 }: { logs: any[]; maxVisible?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!logs || logs.length === 0) return null;
  const visible = expanded ? logs : logs.slice(-maxVisible);
  return (
    <div className="mt-3 space-y-1">
      <div className="bg-secondary/50 border border-border rounded-lg px-3 py-2.5 space-y-1 font-mono text-[11px]">
        {visible.map((l, i) => (
          <div key={i} className={`flex items-start gap-2 ${LOG_COLORS[l.type] ?? ""}`}>
            <LogBadge type={l.type} />
            <span className="leading-snug">{l.message}</span>
            {l.time && <span className="ml-auto text-muted-foreground/50 shrink-0">{l.time}</span>}
          </div>
        ))}
      </div>
      {logs.length > maxVisible && (
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? "Show less" : `Show all ${logs.length} log entries`}
        </button>
      )}
    </div>
  );
}

function StatusPill({ state }: { state: any }) {
  if (state?.running) return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full"><Loader2 className="size-3 animate-spin" /> Running</span>;
  if (state?.done)    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><CheckCircle2 className="size-3" /> Done</span>;
  if (state?.error)   return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full"><XCircle className="size-3" /> Error</span>;
  return null;
}

function AutomationCard({
  icon, title, badge, description, meta, onRun, running, disabled,
  runLabel = "Run automation", children,
}: {
  icon: React.ReactNode; title: string; badge?: React.ReactNode; description: string;
  meta: { label: string; value: string }[]; onRun: () => void; running?: boolean;
  disabled?: boolean; runLabel?: string; children?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-4 px-6 py-5 border-b border-border bg-secondary/20">
        <div className="size-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base">{title}</h3>
            {badge}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y divide-border sm:divide-y-0 sm:divide-x border-b border-border">
        {meta.map((m) => (
          <div key={m.label} className="px-4 py-3">
            <p className="text-[10px] eyebrow text-muted-foreground">{m.label}</p>
            <p className="text-xs font-medium mt-0.5 leading-snug">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="px-6 py-5 space-y-4">
        {children}
        <button
          onClick={onRun} disabled={disabled || running}
          className="inline-flex items-center gap-2 bg-coal text-bone px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brass hover:text-coal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" strokeWidth={1.5} />}
          {running ? "Running…" : runLabel}
        </button>
      </div>
    </div>
  );
}

// ─── 1. DESCRIPTION DOCTOR ───────────────────────────────────────────────────
function DescriptionDoctor() {
  const { data, refetch } = useQuery({ queryKey: ["ai-desc-status"], queryFn: aiGetDescriptionDoctorStatus, refetchInterval: (q) => q.state.data?.state?.running ? 2000 : false });
  const state = data?.state ?? {};
  const startMut = useMutation({ mutationFn: aiStartDescriptionDoctor, onSuccess: () => { toast.success("Description Doctor started."); refetch(); }, onError: (e: any) => toast.error(e?.message ?? "Failed.") });
  return (
    <AutomationCard icon={<FileText className="size-5 text-brass" strokeWidth={1.5} />} title="Description Doctor" badge={<StatusPill state={state} />}
      description="Scans every product for a missing or thin description and generates a polished 40–100 word listing using Groq."
      meta={[{ label: "Targets", value: "Products with < 35 char descriptions" }, { label: "Task key", value: "descriptions" }, { label: "Output", value: "Saved to catalogue" }]}
      onRun={() => startMut.mutate()} running={state.running} disabled={startMut.isPending}
    >
      {(state.running || state.done || state.error) && (
        <div className="space-y-2">
          {state.total > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{state.processed} / {state.total} products</span><span className="font-medium text-foreground">{state.updated} written</span></div>}
          {state.total > 0 && <ProgressBar value={state.processed} total={state.total} />}
          <JobLogs logs={state.logs} />
        </div>
      )}
    </AutomationCard>
  );
}

// ─── 2. TITLE OPTIMIZER ───────────────────────────────────────────────────────
function TitleOptimizer() {
  const { data, refetch } = useQuery({ queryKey: ["ai-title-status"], queryFn: aiGetTitleOptimizerStatus, refetchInterval: (q) => q.state.data?.state?.running ? 2000 : false });
  const state = data?.state ?? {};
  const startMut = useMutation({ mutationFn: aiStartTitleOptimizer, onSuccess: () => { toast.success("Title Optimizer started."); refetch(); }, onError: (e: any) => toast.error(e?.message ?? "Failed.") });
  return (
    <AutomationCard icon={<Type className="size-5 text-brass" strokeWidth={1.5} />} title="Title Optimizer" badge={<StatusPill state={state} />}
      description="Finds products with supplier codes, all-caps, or garbled titles and rewrites them in clean Daraz-style Title Case."
      meta={[{ label: "Targets", value: "Bad titles (codes, all-caps, >120 chars)" }, { label: "Task key", value: "titles" }, { label: "Output", value: "Saved to catalogue" }]}
      onRun={() => startMut.mutate()} running={state.running} disabled={startMut.isPending}
    >
      {(state.running || state.done || state.error) && (
        <div className="space-y-2">
          {state.total > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{state.processed} / {state.total} candidates</span><span className="font-medium text-foreground">{state.updated} improved</span></div>}
          {state.total > 0 && <ProgressBar value={state.processed} total={state.total} />}
          <JobLogs logs={state.logs} />
        </div>
      )}
    </AutomationCard>
  );
}

// ─── 3. REVIEW INTELLIGENCE ───────────────────────────────────────────────────
function ReviewIntelligence() {
  const analyzeMut = useMutation({ mutationFn: aiAnalyzeReviews, onError: (e: any) => toast.error(e?.message ?? "Analysis failed.") });
  const ins = analyzeMut.data?.insights;
  const sentimentColor = ins?.sentiment === "positive" ? "text-emerald-600" : ins?.sentiment === "negative" ? "text-red-600" : "text-amber-600";
  return (
    <AutomationCard icon={<MessageSquareHeart className="size-5 text-brass" strokeWidth={1.5} />} title="Review Intelligence"
      description="Reads all product and site reviews, returning top praise themes, complaints, a sentiment verdict, and 3 actionable recommendations."
      meta={[{ label: "Sources", value: "Product + website reviews" }, { label: "Task key", value: "reviews" }, { label: "Output", value: "On-screen only" }]}
      onRun={() => analyzeMut.mutate()} running={analyzeMut.isPending} disabled={analyzeMut.isPending} runLabel="Analyse now"
    >
      {analyzeMut.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="size-4 animate-spin text-brass" />Analysing reviews…</div>}
      {ins && !analyzeMut.isPending && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-1">
          <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden text-center">
            <div className="bg-background px-3 py-3"><p className="font-display italic text-2xl">{ins.averageRating?.toFixed(1)}</p><p className="text-[10px] eyebrow text-muted-foreground mt-0.5">Avg rating</p></div>
            <div className="bg-background px-3 py-3"><p className={`font-display italic text-2xl ${sentimentColor}`}>{ins.sentiment}</p><p className="text-[10px] eyebrow text-muted-foreground mt-0.5">Overall</p></div>
            <div className="bg-background px-3 py-3"><p className="font-display italic text-2xl">{ins.total}</p><p className="text-[10px] eyebrow text-muted-foreground mt-0.5">Reviews</p></div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed bg-secondary/50 border border-border rounded-lg px-4 py-3">{ins.summary}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <InsightList title="Top praises" items={ins.topPraises} color="emerald" />
            <InsightList title="Top complaints" items={ins.topComplaints} color="red" />
          </div>
          {ins.actionItems?.length > 0 && (
            <div>
              <p className="text-xs font-medium eyebrow text-muted-foreground mb-2">Recommended actions</p>
              <ul className="space-y-1.5">{ins.actionItems.map((a: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 size-1.5 rounded-full bg-brass shrink-0" />{a}</li>)}</ul>
            </div>
          )}
        </motion.div>
      )}
    </AutomationCard>
  );
}

function InsightList({ title, items, color }: { title: string; items: string[]; color: "emerald" | "red" }) {
  const dot = color === "emerald" ? "bg-emerald-500" : "bg-red-400";
  const bg  = color === "emerald" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100";
  return (
    <div className={`border rounded-lg px-4 py-3 ${bg}`}>
      <p className="text-xs font-medium eyebrow text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">{(items || []).map((item: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm"><span className={`mt-1.5 size-1.5 rounded-full ${dot} shrink-0`} />{item}</li>)}</ul>
    </div>
  );
}

// ─── 4. DUPLICATE RADAR ───────────────────────────────────────────────────────
function DuplicateRadar() {
  const qc = useQueryClient();
  const scanMut = useMutation({ mutationFn: aiFindDuplicates, onError: (e: any) => toast.error(e?.message ?? "Scan failed.") });
  const hideMut = useMutation({ mutationFn: aiHideProduct, onSuccess: () => { toast.success("Product hidden."); }, onError: (e: any) => toast.error(e?.message ?? "Failed.") });
  const result = scanMut.data;
  const groups: any[][] = result?.groups ?? [];
  return (
    <AutomationCard icon={<ScanSearch className="size-5 text-brass" strokeWidth={1.5} />} title="Duplicate Radar"
      description="Sends your catalogue to AI for analysis. Returns clusters of likely-duplicate listings so you can quickly hide the extras."
      meta={[{ label: "Scans", value: "Up to 500 active products" }, { label: "Task key", value: "duplicates" }, { label: "Action", value: "Hide with one click" }]}
      onRun={() => scanMut.mutate()} running={scanMut.isPending} disabled={scanMut.isPending} runLabel="Scan catalogue"
    >
      {scanMut.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="size-4 animate-spin text-brass" />Scanning for duplicates…</div>}
      {result && !scanMut.isPending && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">Scanned <strong>{result.scanned}</strong> products — found <strong>{groups.length}</strong> duplicate group{groups.length !== 1 ? "s" : ""}.</p>
          {groups.length === 0 && <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"><CheckCircle2 className="size-4 shrink-0" />No duplicates detected — catalogue looks clean!</div>}
          {groups.map((group, gi) => (
            <div key={gi} className="border border-border rounded-lg overflow-hidden">
              <div className="bg-secondary/40 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-medium eyebrow text-muted-foreground">Group {gi + 1} — {group.length} similar products</span>
                <AlertTriangle className="size-3.5 text-amber-500" strokeWidth={1.5} />
              </div>
              <div className="divide-y divide-border">
                {group.map((p: any) => (
                  <div key={p._id} className="flex items-center gap-3 px-4 py-2.5">
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="size-9 rounded object-cover shrink-0 bg-secondary" />}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div>
                    <button onClick={() => hideMut.mutate(p._id)} disabled={hideMut.isPending} className="shrink-0 flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-50"><EyeOff className="size-3" strokeWidth={1.5} />Hide</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AutomationCard>
  );
}

// ─── 5. SEO BOOSTER ──────────────────────────────────────────────────────────
function SeoBooster() {
  const { data, refetch } = useQuery({ queryKey: ["ai-seo-status"], queryFn: aiGetSeoBoosterStatus, refetchInterval: (q) => q.state.data?.state?.running ? 2000 : false });
  const state = data?.state ?? {};
  const startMut = useMutation({ mutationFn: aiStartSeoBooster, onSuccess: () => { toast.success("SEO Booster started."); refetch(); }, onError: (e: any) => toast.error(e?.message ?? "Failed.") });
  return (
    <AutomationCard icon={<Search className="size-5 text-brass" strokeWidth={1.5} />} title="SEO Booster" badge={<StatusPill state={state} />}
      description="Generates 6–10 targeted search keywords for every product that doesn't have them yet — covering product type, use case, and Pakistan-specific buyer intent."
      meta={[{ label: "Targets", value: "Products without search keywords" }, { label: "Task key", value: "seo" }, { label: "Output", value: "Saved as keywords field" }]}
      onRun={() => startMut.mutate()} running={state.running} disabled={startMut.isPending}
    >
      {(state.running || state.done || state.error) && (
        <div className="space-y-2">
          {state.total > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{state.processed} / {state.total} products</span><span className="font-medium text-foreground">{state.updated} keyworded</span></div>}
          {state.total > 0 && <ProgressBar value={state.processed} total={state.total} />}
          <JobLogs logs={state.logs} />
        </div>
      )}
    </AutomationCard>
  );
}

// ─── 6. PRICE INTELLIGENCE ───────────────────────────────────────────────────
function PriceIntelligence() {
  const analyzeMut = useMutation({ mutationFn: aiAnalyzePricing, onError: (e: any) => toast.error(e?.message ?? "Analysis failed.") });
  const ins = analyzeMut.data?.insights;
  const healthColor = ins?.overallHealth === "good" ? "text-emerald-600" : ins?.overallHealth === "poor" ? "text-red-600" : "text-amber-600";
  return (
    <AutomationCard icon={<TrendingUp className="size-5 text-brass" strokeWidth={1.5} />} title="Price Intelligence"
      description="Analyses your entire catalogue by category — surfacing pricing gaps, underpriced outliers, quick-win opportunities, and a strategic pricing health score."
      meta={[{ label: "Analyses", value: "Full catalogue by category" }, { label: "Task key", value: "pricing" }, { label: "Output", value: "On-screen insights" }]}
      onRun={() => analyzeMut.mutate()} running={analyzeMut.isPending} disabled={analyzeMut.isPending} runLabel="Analyse pricing"
    >
      {analyzeMut.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="size-4 animate-spin text-brass" />Analysing pricing strategy…</div>}
      {ins && !analyzeMut.isPending && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-1">
          <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden text-center">
            <div className="bg-background px-3 py-3"><p className={`font-display italic text-2xl ${healthColor}`}>{ins.overallHealth}</p><p className="text-[10px] eyebrow text-muted-foreground mt-0.5">Health</p></div>
            <div className="bg-background px-3 py-3"><p className="font-display italic text-2xl">{ins.totalProducts}</p><p className="text-[10px] eyebrow text-muted-foreground mt-0.5">Products</p></div>
            <div className="bg-background px-3 py-3"><p className="font-display italic text-2xl">{ins.categories}</p><p className="text-[10px] eyebrow text-muted-foreground mt-0.5">Categories</p></div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed bg-secondary/50 border border-border rounded-lg px-4 py-3">{ins.summary}</p>
          {ins.categoryInsights?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium eyebrow text-muted-foreground">Category breakdown</p>
              {ins.categoryInsights.map((ci: any, i: number) => (
                <div key={i} className="border border-border rounded-lg px-4 py-3">
                  <p className="text-sm font-medium">{ci.category}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ci.assessment}</p>
                  {ci.recommendation && <p className="text-xs text-brass mt-1.5 font-medium">→ {ci.recommendation}</p>}
                </div>
              ))}
            </div>
          )}
          {ins.quickWins?.length > 0 && (
            <div>
              <p className="text-xs font-medium eyebrow text-muted-foreground mb-2">Quick wins</p>
              <ul className="space-y-1.5">{ins.quickWins.map((w: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 size-1.5 rounded-full bg-brass shrink-0" />{w}</li>)}</ul>
            </div>
          )}
        </motion.div>
      )}
    </AutomationCard>
  );
}

// ─── 7. CATEGORY FIXER ───────────────────────────────────────────────────────
function CategoryFixer() {
  const { data, refetch } = useQuery({ queryKey: ["ai-category-status"], queryFn: aiGetCategoryFixerStatus, refetchInterval: (q) => q.state.data?.state?.running ? 2000 : false });
  const state = data?.state ?? {};
  const startMut = useMutation({ mutationFn: aiStartCategoryFixer, onSuccess: () => { toast.success("Category Fixer started."); refetch(); }, onError: (e: any) => toast.error(e?.message ?? "Failed.") });
  return (
    <AutomationCard icon={<FolderSync className="size-5 text-brass" strokeWidth={1.5} />} title="Category Fixer" badge={<StatusPill state={state} />}
      description="Scans your entire catalogue and uses AI to identify products that are likely in the wrong category — then automatically corrects them."
      meta={[{ label: "Targets", value: "All active products" }, { label: "Task key", value: "categories" }, { label: "Output", value: "Saved to catalogue" }]}
      onRun={() => startMut.mutate()} running={state.running} disabled={startMut.isPending}
    >
      {(state.running || state.done || state.error) && (
        <div className="space-y-2">
          {state.total > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{state.processed} / {state.total} products</span><span className="font-medium text-foreground">{state.updated} recategorised</span></div>}
          {state.total > 0 && <ProgressBar value={state.processed} total={state.total} />}
          <JobLogs logs={state.logs} />
        </div>
      )}
    </AutomationCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function PoolStatus() {
  const { data } = useQuery({ queryKey: ["ai-pool-status"], queryFn: aiGetPoolStatus, refetchInterval: 10_000 });
  const groq = data?.groq;
  const gemini = data?.gemini;
  if (!groq && !gemini) return null;
  const KeyChip = ({ children }: { children: React.ReactNode }) => (
    <span className="px-1.5 py-0.5 rounded bg-secondary/70 border border-border font-mono text-[10px] text-muted-foreground">{children}</span>
  );
  const PoolCard = ({ name, icon, total, healthy, cooling, disabled, throttles, model, children }: any) => (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">{icon} {name}</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> {healthy}/{total} healthy
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden mt-3 text-center">
        <div className="bg-background px-2 py-2"><p className="font-display italic text-xl">{cooling}</p><p className="text-[9px] eyebrow text-muted-foreground">cooling</p></div>
        <div className="bg-background px-2 py-2"><p className="font-display italic text-xl">{disabled}</p><p className="text-[9px] eyebrow text-muted-foreground">disabled</p></div>
        <div className="bg-background px-2 py-2"><p className="font-display italic text-xl">{throttles}</p><p className="text-[9px] eyebrow text-muted-foreground">throttles</p></div>
      </div>
      {model && <p className="mt-2.5 font-mono text-[10px] text-muted-foreground">{model}</p>}
      {children && <div className="mt-2.5 flex flex-wrap gap-1">{children}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PoolCard
        name="Gemini · preferred" icon={<Sparkles className="size-3.5 text-brass" strokeWidth={1.5} />}
        total={gemini?.total ?? 0} healthy={gemini?.healthy ?? 0} cooling={gemini?.cooling ?? 0}
        disabled={gemini?.disabled ?? 0} throttles={gemini?.throttles ?? 0}
        model={gemini?.keys?.map((k: any) => k.model).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(" + ")}
      >
        {(gemini?.keys ?? []).map((k: any) => <KeyChip key={k.preview}>{k.preview}</KeyChip>)}
      </PoolCard>
      <PoolCard
        name="Groq · fallback" icon={<BrainCircuit className="size-3.5 text-brass" strokeWidth={1.5} />}
        total={groq?.total ?? 0} healthy={groq?.healthy ?? 0} cooling={groq?.cooling ?? 0}
        disabled={groq?.disabled ?? 0} throttles={groq?.throttles ?? 0}
        model="llama-3.1-8b-instant · llama-3.3-70b-versatile"
      >
        {(groq?.keys ?? []).map((k: string) => <KeyChip key={k}>{k}</KeyChip>)}
      </PoolCard>
    </div>
  );
}

function AIStudioPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-8">
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2 text-xs">
          <BrainCircuit className="size-3.5 text-brass" /> Powered by Gemini flash-lite · Groq 8B fallback
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">AI Studio<span className="text-brass">.</span></h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Seven one-click automations running on your pooled Gemini + Groq API keys. Gemini handles bulk jobs first; if it hiccups, the router falls back to the Groq fleet instantly.
        </p>
      </div>

      <PoolStatus />

      <div className="flex items-start gap-3 bg-brass/8 border border-brass/20 rounded-xl px-5 py-4">
        <Sparkles className="size-4 text-brass shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-foreground/80 leading-relaxed">
          <strong>Background jobs</strong> (Description Doctor, Title Optimizer, SEO Booster, Category Fixer) run server-side and save directly to your catalogue — navigate away and come back.{" "}
          <strong>One-shot tools</strong> (Review Intelligence, Duplicate Radar, Price Intelligence) return results on-screen immediately.{" "}
          Big batches hit Gemini first; on any failure the router splits them and fans out across the Groq fleet — nothing dies mid-run.
        </p>
      </div>

      {/* Background jobs */}
      <div>
        <p className="eyebrow text-muted-foreground text-xs mb-4 flex items-center gap-2"><RefreshCw className="size-3" /> Background jobs — run &amp; navigate away</p>
        <div className="space-y-6">
          <DescriptionDoctor />
          <TitleOptimizer />
          <SeoBooster />
          <CategoryFixer />
        </div>
      </div>

      {/* One-shot tools */}
      <div>
        <p className="eyebrow text-muted-foreground text-xs mb-4 flex items-center gap-2"><BarChart3 className="size-3" /> One-shot tools — instant on-screen results</p>
        <div className="space-y-6">
          <ReviewIntelligence />
          <PriceIntelligence />
          <DuplicateRadar />
        </div>
      </div>
    </motion.div>
  );
}
