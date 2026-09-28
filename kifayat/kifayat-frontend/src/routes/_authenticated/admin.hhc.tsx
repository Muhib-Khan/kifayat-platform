import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import {
  hhcGetSyncStatus,
  hhcQuickFetch,
  hhcStopSync,
  hhcSyncAll,
  hhcTestToken,
  hhcGetSavedToken,
  hhcSyncDynamicAll,
  hhcGetDynamicSyncStatus,
  hhcStopDynamicSync,
  recategorizeProducts,
} from "@/lib/admin.functions";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  RefreshCw, StopCircle, Radio, Clock, Rocket, PartyPopper, OctagonAlert, 
  CheckCircle, XCircle, Eraser, Database, Zap, Timer, Shield, Tag, Box, Play, Check, Trash2, KeyRound,
  ClipboardList, Image as ImageIcon, Video as VideoIcon, Boxes, ListTree, Sparkles
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hhc")({
  component: HhcPage,
});

type LogEntry = { type: string; message: string; time: string };

const LOG_ICONS: Record<string, any> = {
  success: CheckCircle, error: XCircle, cleanup: Eraser, db_progress: Database,
  fetching: Radio, waiting: Clock, all_started: Rocket, all_complete: PartyPopper,
  aborted: OctagonAlert, stopped: StopCircle,
  progress: CheckCircle, discovery: Radio, sync_started: Rocket, retry: RefreshCw,
  grand_started: Sparkles, catalog: ListTree, done: PartyPopper, grand_done: PartyPopper,
  seo_started: Sparkles, seo_done: PartyPopper, seo_skipped: Tag, warn: OctagonAlert,
};

const LOG_COLORS: Record<string, string> = {
  success: "#10b981", error: "#ef4444", cleanup: "#f59e0b", db_progress: "#34d399",
  fetching: "#3b82f6", waiting: "#f59e0b", all_started: "#8b5cf6", all_complete: "#10b981",
  aborted: "#ef4444", stopped: "#ef4444",
  progress: "#c9a14a", discovery: "#3b82f6", sync_started: "#8b5cf6", retry: "#f59e0b",
  grand_started: "#c9a14a", catalog: "#3b82f6", done: "#10b981", grand_done: "#10b981",
  seo_started: "#c9a14a", seo_done: "#10b981", seo_skipped: "#f59e0b", warn: "#f59e0b",
};

function HhcPage() {
  const [token, setToken] = useState(() => localStorage.getItem("hhc_token") ?? "");
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [quickFetching, setQuickFetching] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);
  const [recatLogs, setRecatLogs] = useState<LogEntry[]>([]);
  const [recatProgress, setRecatProgress] = useState<{ processed: number; total: number; updated: number; done: boolean } | null>(null);
  const recatLogsContainerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [grandRunning, setGrandRunning] = useState(false);
  const [grandPhase, setGrandPhase] = useState<"catalog" | "fetch" | "seo" | null>(null);
  const [grandLogs, setGrandLogs] = useState<LogEntry[]>([]);
  const [grandProgress, setGrandProgress] = useState<{
    total: number;
    processed: number;
    ok: number;
    withVideos: number;
    withVariations: number;
    notFound: number;
    failed: number;
    seoUpdated: number;
    done: boolean;
  } | null>(null);
  const grandLogsRef = useRef<HTMLDivElement>(null);

  // Keep only the nested log panel pinned. useLayoutEffect runs before paint,
  // avoiding the page-layout jump that occurred while progress entries arrived.
  useLayoutEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;
    const wasNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    if (wasNearBottom) container.scrollTop = container.scrollHeight;
  }, [logs]);

  // Terminal event types that mean the HHC sync has finished
  const HHC_DONE_TYPES = new Set(["all_complete", "aborted", "stopped"]);

  // Restore state on mount + subscribe to live socket events
  useEffect(() => {
    // One-time HTTP call to hydrate any in-progress sync that started before
    // this page was opened
    hhcGetSyncStatus().then((d) => {
      if (d.success) {
        setRunning(!!d.running);
        if (d.logs?.length) setLogs(d.logs.map((l: any) => ({ ...l, time: l.time ?? "—" })));
        if (d.summary) setSummary(d.summary);
      }
    }).catch(() => {});

    // Prefill the token from the server so it only needs to be entered once
    // and is shared by the pagination sync AND the dynamic data fetches
    hhcGetSavedToken().then((d) => {
      if (d.success && d.token) {
        setHasSavedToken(true);
        setToken((cur) => {
          if (!cur && d.token) {
            localStorage.setItem("hhc_token", d.token);
            return d.token;
          }
          return cur;
        });
      }
    }).catch(() => {});

    // Restore any in-progress Grand Sync (it runs in the background, so it
    // survives page switches) + subscribe to its live socket events
    hhcGetDynamicSyncStatus().then((d) => {
      if (d.success && d.running) {
        setGrandRunning(true);
        if (d.phase) setGrandPhase(d.phase);
        if (d.logs?.length) setGrandLogs(d.logs.map((l: any) => ({ ...l, time: l.time ?? "—" })));
        if (d.total > 0) {
          setGrandProgress({
            total: d.total,
            processed: d.processed ?? 0,
            ok: d.ok ?? 0,
            withVideos: d.withVideos ?? 0,
            withVariations: d.withVariations ?? 0,
            notFound: d.notFound ?? 0,
            failed: d.failed ?? 0,
            seoUpdated: d.seoUpdated ?? 0,
            done: false,
          });
        }
      }
    }).catch(() => {});

    const socket = getSocket();

    const GRAND_DONE_TYPES = new Set(["grand_done", "stopped", "error"]);

    const onGrandProgress = (entry: any) => {
      const logEntry: LogEntry = {
        type: entry.type ?? "info",
        message: entry.message ?? "",
        time: entry.time ?? new Date().toLocaleTimeString(),
      };
      setGrandLogs((prev) => [...prev, logEntry]);
      if (entry.type === "catalog") setGrandPhase("catalog");
      else if (entry.type === "seo_started") setGrandPhase("seo");
      else if (entry.type === "grand_started" && entry.total) setGrandPhase("fetch");
      else if (GRAND_DONE_TYPES.has(entry.type)) setGrandPhase(null);
      setGrandProgress((prev) => {
        if (entry.total) {
          return {
            total: entry.total ?? prev?.total ?? 0,
            processed: entry.processed ?? prev?.processed ?? 0,
            ok: entry.ok ?? prev?.ok ?? 0,
            withVideos: entry.withVideos ?? prev?.withVideos ?? 0,
            withVariations: entry.withVariations ?? prev?.withVariations ?? 0,
            notFound: entry.notFound ?? prev?.notFound ?? 0,
            failed: entry.failed ?? prev?.failed ?? 0,
            seoUpdated: entry.updated ?? prev?.seoUpdated ?? 0,
            done: GRAND_DONE_TYPES.has(entry.type),
          };
        }
        return prev;
      });
      if (GRAND_DONE_TYPES.has(entry.type)) setGrandRunning(false);
    };

    // hhc_progress: stream live log entries from the backend
    const onHhcProgress = (entry: any) => {
      const logEntry: LogEntry = {
        type: entry.type ?? "info",
        message: entry.message ?? "",
        time: entry.time ?? new Date().toLocaleTimeString(),
      };
      setLogs((prev) => [...prev, logEntry]);
      if (entry.summary) setSummary(entry.summary);
      if (HHC_DONE_TYPES.has(entry.type)) setRunning(false);
    };

    // recategorize_progress: stream live log + progress bar updates
    const onRecategorizeProgress = (entry: any) => {
      const logEntry: LogEntry = {
        type: entry.type ?? "progress",
        message: entry.message ?? "",
        time: entry.time ?? new Date().toLocaleTimeString(),
      };
      setRecatLogs((prev) => [...prev, logEntry]);
      if (entry.total) {
        setRecatProgress({
          processed: entry.processed ?? 0,
          total: entry.total,
          updated: entry.updated ?? 0,
          done: entry.type === "done" || entry.type === "error",
        });
      }
      if (entry.type === "done" || entry.type === "error") setRecategorizing(false);
    };

    socket.on("hhc_progress", onHhcProgress);
    socket.on("recategorize_progress", onRecategorizeProgress);
    socket.on("dynamic_all_progress", onGrandProgress);

    return () => {
      socket.off("hhc_progress", onHhcProgress);
      socket.off("recategorize_progress", onRecategorizeProgress);
      socket.off("dynamic_all_progress", onGrandProgress);
    };
  }, []);

  const saveToken = (v: string) => { setToken(v); localStorage.setItem("hhc_token", v); };
  const clearToken = () => { setToken(""); localStorage.removeItem("hhc_token"); setHasSavedToken(false); };

  const handleTest = async () => {
    if (!token) return;
    setTesting(true); setFeedback(null);
    try {
      const res = await hhcTestToken(token);
      if (res.valid) setHasSavedToken(true);
      setFeedback({ type: res.valid ? "success" : "error", text: res.valid ? "Token is valid — saved on server!" : `Token invalid. Status ${res.status}.` });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message ?? "Failed to test token." });
    }
    setTesting(false);
  };

  const handleQuickFetch = async () => {
    if (!token || running) return;
    setQuickFetching(true); setFeedback(null); setLogs([]); setSummary(null);
    try {
      const res = await hhcQuickFetch(token);
      setHasSavedToken(true);
      setFeedback({ type: "success", text: `Quick fetch: ${res.productCount ?? "?"} products. Created: ${res.dbResult?.created ?? 0}, Updated: ${res.dbResult?.updated ?? 0}` });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message ?? "Quick fetch failed." });
    }
    setQuickFetching(false);
  };

  const handleSyncAll = async () => {
    if (!token || running) return;
    if (!window.confirm("This will fetch ALL pages (~21 min) and sync all HHC products. Continue?")) return;
    setRunning(true); setFeedback(null); setLogs([]); setSummary(null);
    try {
      const res = await hhcSyncAll(token, 211);
      setHasSavedToken(true);
      setSummary(res?.summary);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message ?? "Sync failed." });
    }
    setRunning(false);
  };

  const handleStop = async () => {
    try { await hhcStopSync(); } catch { /* ignore */ }
    setRunning(false);
  };

  useLayoutEffect(() => {
    const container = recatLogsContainerRef.current;
    if (!container) return;
    const wasNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    if (wasNearBottom) container.scrollTop = container.scrollHeight;
  }, [recatLogs]);

  const handleRecategorize = async () => {
    if (!window.confirm("This will re-classify all products into categories based on their names and descriptions. Continue?")) return;
    setRecategorizing(true); setFeedback(null); setRecatLogs([]); setRecatProgress(null);
    try {
      // Backend responds immediately and streams progress via recategorize_progress socket events
      await recategorizeProducts();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message ?? "Re-categorization failed." });
      setRecategorizing(false);
    }
  };

  const handleGrandSync = async () => {
    if ((!token && !hasSavedToken) || running || grandRunning) return;
    if (!window.confirm("Grand Sync will fetch pictures, videos and variations for ALL products (~8,400) from HHC, then AI re-categorize and SEO-optimize every product. It runs in the background (~40 min) — you can leave this page. Continue?")) return;
    setGrandRunning(true); setFeedback(null); setGrandLogs([]); setGrandProgress(null);
    try {
      const res = await hhcSyncDynamicAll(token);
      setFeedback({ type: "success", text: res.message ?? "Grand Sync started." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message ?? "Failed to start Grand Sync." });
      setGrandRunning(false);
    }
  };

  const handleGrandStop = async () => {
    try { await hhcStopDynamicSync(); } catch { /* ignore */ }
  };

  useLayoutEffect(() => {
    const container = grandLogsRef.current;
    if (!container) return;
    const wasNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    if (wasNearBottom) container.scrollTop = container.scrollHeight;
  }, [grandLogs]);

  const clearAll = () => { setLogs([]); setSummary(null); setFeedback(null); };
  const clearRecat = () => { setRecatLogs([]); setRecatProgress(null); };
  const clearGrand = () => { setGrandLogs([]); setGrandProgress(null); };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <p className="eyebrow text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-px bg-brass"></span> Vendor Integration
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            HHC Sync<span className="text-brass">.</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 font-medium">Proxied securely via backend.</p>
        </div>
        {running && (
          <button onClick={handleStop}
            className="flex items-center gap-2 px-5 py-3 text-sm font-bold bg-red-500/10 border border-red-500/30 text-red-600 rounded-xl hover:bg-red-500/20 transition-colors shadow-sm">
            <StopCircle className="size-4" /> Stop Sync
          </button>
        )}
      </div>

      {/* Info bar */}
      <div className="bg-secondary/30 border border-border rounded-xl p-4 flex gap-x-8 gap-y-3 flex-wrap text-sm font-bold text-muted-foreground shadow-sm">
        <span className="flex items-center gap-2"><Zap className="size-4 text-amber-500" /> 10 req/min limit</span>
        <span className="flex items-center gap-2"><Timer className="size-4 text-blue-500" /> 5–7s random delay</span>
        <span className="flex items-center gap-2"><Shield className="size-4 text-emerald-500" /> Browser headers spoofed</span>
        <span className="flex items-center gap-2"><Eraser className="size-4 text-red-500" /> Auto-deletes stale items</span>
      </div>

      {/* Token input */}
      <div className="bg-card shadow-e1 border border-border rounded-xl p-6 md:p-8 space-y-4">
        <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          <KeyRound className="size-4 text-brass" /> Bearer Token <span className="font-medium normal-case tracking-normal">(expires every 12h)</span>
          {hasSavedToken && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold normal-case tracking-normal bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-2.5 py-1 rounded-full">
              <CheckCircle className="size-3" /> Saved on server — used by all syncs
            </span>
          )}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="password" value={token} disabled={running}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="Paste HHC Bearer token here…"
            className="flex-1 bg-background border border-border rounded-xl px-5 py-3.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass disabled:opacity-50 shadow-sm transition-all"
          />
          <div className="flex gap-3">
            <button onClick={handleTest} disabled={!token || testing || running}
              className="px-6 py-3.5 text-sm font-bold border border-border bg-secondary/50 rounded-xl text-foreground hover:bg-secondary disabled:opacity-40 transition-colors shadow-sm whitespace-nowrap flex items-center gap-2">
              {testing ? <RefreshCw className="size-4 animate-spin text-brass" /> : <Shield className="size-4 text-brass" />}
              {testing ? "Testing…" : "Verify & Save"}
            </button>
            {token && !running && (
              <button onClick={clearToken} className="px-4 py-3.5 text-sm font-bold text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-colors">Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 flex-wrap">
        <button onClick={handleSyncAll} disabled={(!token && !hasSavedToken) || running || grandRunning}
          className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-coal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-e1">
          <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Syncing… (~21 min)" : "Sync All Products"}
        </button>
        <button onClick={handleQuickFetch} disabled={(!token && !hasSavedToken) || running || quickFetching || grandRunning}
          className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold border border-border bg-card text-foreground rounded-xl hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
          {quickFetching ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
          {quickFetching ? "Fetching…" : "Quick Fetch (Page 1)"}
        </button>
        <button onClick={handleRecategorize} disabled={running || recategorizing || grandRunning}
          className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold border border-border bg-card text-foreground rounded-xl hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
          {recategorizing ? <RefreshCw className="size-4 animate-spin" /> : <Tag className="size-4" />}
          {recategorizing ? "Re-categorizing…" : "Re-categorize DB"}
        </button>
        {(summary || logs.length > 0) && !running && (
          <button onClick={clearAll}
            className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors ml-auto">
            <Eraser className="size-4" /> Clear Logs
          </button>
        )}
      </div>

      {/* ── Grand Sync — pictures, videos & variations for ALL products ── */}
      <div className="bg-card shadow-e1 border-2 border-brass/40 rounded-2xl p-6 md:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display italic text-2xl tracking-tight flex items-center gap-3">
              <Sparkles className="size-6 text-brass" />
              Grand Sync<span className="text-brass">.</span>
            </h3>
            <p className="text-muted-foreground text-sm mt-1.5 font-medium">
              Fetch <span className="text-brass font-bold">pictures</span>,{" "}
              <span className="text-brass font-bold">videos</span> &{" "}
              <span className="text-brass font-bold">variations</span> for every product, then AI{" "}
              <span className="text-brass font-bold">re-categorizes</span> &{" "}
              <span className="text-brass font-bold">SEO-optimizes</span> them all.
              Runs in the background; leave this page anytime.
            </p>
          </div>
          {grandRunning && (
            <button onClick={handleGrandStop}
              className="flex items-center gap-2 px-5 py-3 text-sm font-bold bg-red-500/10 border border-red-500/30 text-red-600 rounded-xl hover:bg-red-500/20 transition-colors shadow-sm self-start">
              <StopCircle className="size-4" /> Stop Grand Sync
            </button>
          )}
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="relative inline-flex group">
            <button onClick={handleGrandSync}
              disabled={(!token && !hasSavedToken) || running || grandRunning}
              className="flex items-center gap-2 px-8 py-4 text-base font-black bg-brass text-coal rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-e1">
              {grandRunning ? <RefreshCw className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              {grandRunning ? "Grand Syncing…" : "Start Grand Sync"}
            </button>
          </div>
          <div className="flex items-center gap-5 text-xs font-bold text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><ImageIcon className="size-4 text-brass" /> Pictures</span>
            <span className="flex items-center gap-1.5"><VideoIcon className="size-4 text-brass" /> Videos</span>
            <span className="flex items-center gap-1.5"><Boxes className="size-4 text-brass" /> Variations</span>
          </div>
          {(grandLogs.length > 0 || grandProgress) && !grandRunning && (
            <button onClick={clearGrand}
              className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors ml-auto">
              <Eraser className="size-4" /> Clear Grand Logs
            </button>
          )}
        </div>

        {grandRunning && (
          <div className="flex items-center gap-2 text-sm font-bold text-amber-500">
            <div className="size-2 rounded-full bg-amber-500 animate-pulse" /> Live —{" "}
            {grandPhase === "catalog" && "scanning the HHC catalog…"}
            {grandPhase === "fetch" && "fetching pictures, videos & variations…"}
            {grandPhase === "seo" && "AI re-categorizing & SEO-optimizing…"}
            {!grandPhase && "syncing all products now"}
          </div>
        )}

        {/* Grand progress bar + stats */}
        {grandProgress && grandProgress.total > 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span>{grandProgress.processed.toLocaleString()} / {grandProgress.total.toLocaleString()} products</span>
                <span className="text-foreground">{Math.round((grandProgress.processed / grandProgress.total) * 100)}%</span>
              </div>
              <div className="h-3 bg-secondary border border-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brass to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((grandProgress.processed / grandProgress.total) * 100))}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 flex-wrap text-xs font-bold">
              <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                <CheckCircle className="size-4" /> {grandProgress.ok.toLocaleString()} Fetched
              </span>
              <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-600">
                <VideoIcon className="size-4" /> {grandProgress.withVideos.toLocaleString()} Videos
              </span>
              <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600">
                <Boxes className="size-4" /> {grandProgress.withVariations.toLocaleString()} Variations
              </span>
              <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600">
                <XCircle className="size-4" /> {grandProgress.notFound.toLocaleString()} Not found
              </span>
              <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-muted-foreground">
                <OctagonAlert className="size-4" /> {grandProgress.failed.toLocaleString()} Errors
              </span>
              {grandProgress.seoUpdated > 0 && (
                <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brass/10 border border-brass/30 text-brass">
                  <Tag className="size-4" /> {grandProgress.seoUpdated.toLocaleString()} SEO-optimized
                </span>
              )}
            </div>
          </div>
        )}

        {/* Grand live log */}
        {grandLogs.length > 0 && (
          <div ref={grandLogsRef} style={{ overflowAnchor: "none" }} className="bg-card border border-border shadow-inner rounded-xl p-5 max-h-[300px] overflow-y-auto overscroll-contain font-mono text-xs font-medium space-y-1.5">
            {grandLogs.map((log, i) => {
              const Icon = LOG_ICONS[log.type] ?? Sparkles;
              return (
                <div key={i} className="flex items-start gap-3 py-1 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors rounded px-2">
                  <span className="text-muted-foreground/60 w-16 shrink-0 pt-0.5">{log.time}</span>
                  <Icon className="size-4 shrink-0" style={{ color: LOG_COLORS[log.type] ?? "#c9a14a" }} strokeWidth={2.5} />
                  <span style={{ color: LOG_COLORS[log.type] ?? "#c9a14a" }} className="leading-relaxed break-words min-w-0 flex-1">{log.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {/* Feedback */}
        {feedback && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`px-5 py-4 rounded-xl text-sm font-bold border flex items-center gap-3 ${feedback.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600"}`}>
              {feedback.type === "success" ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
              {feedback.text}
            </div>
          </motion.div>
        )}

        {/* Live progress log */}
        {logs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h4 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              Sync Progress {running && <span className="text-amber-500 text-sm flex items-center gap-1 font-sans"><div className="size-2 rounded-full bg-amber-500 animate-pulse" /> Live</span>}
            </h4>
            <div ref={logsContainerRef} style={{ overflowAnchor: "none" }} className="bg-card border border-border shadow-inner rounded-xl p-5 max-h-[400px] overflow-y-auto overscroll-contain font-mono text-xs font-medium space-y-1.5">
              {logs.map((log, i) => {
                const Icon = LOG_ICONS[log.type] ?? ClipboardList;
                return (
                  <div key={i} className="flex items-start gap-3 py-1 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors rounded px-2">
                    <span className="text-muted-foreground/60 w-16 shrink-0 pt-0.5">{log.time}</span>
                    <Icon className="size-4 shrink-0" style={{ color: LOG_COLORS[log.type] ?? "#94a3b8" }} strokeWidth={2.5} />
                    <span style={{ color: LOG_COLORS[log.type] ?? "#64748b" }} className="leading-relaxed break-words min-w-0 flex-1">{log.message}</span>
                  </div>
                );
              })}
            </div>

            {summary && (
              <div className="flex gap-4 flex-wrap text-sm font-bold bg-card shadow-e1 border border-border p-5 rounded-xl">
                <span className="text-emerald-600 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg"><CheckCircle className="size-4" /> {summary.pagesFetched ?? 0} pages</span>
                <span className="text-blue-600 flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-lg"><Database className="size-4" /> {summary.totalCreated ?? 0} created</span>
                <span className="text-amber-600 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg"><RefreshCw className="size-4" /> {summary.totalUpdated ?? 0} updated</span>
                <span className="text-red-600 flex items-center gap-1.5 bg-red-500/10 px-3 py-1.5 rounded-lg"><Trash2 className="size-4" /> {summary.deletedCount ?? 0} removed</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Re-categorise progress panel */}
        {(recategorizing || recatProgress) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                Classification Progress{" "}
                {recategorizing && !recatProgress?.done && (
                  <span className="text-amber-500 text-sm flex items-center gap-1 font-sans"><div className="size-2 rounded-full bg-amber-500 animate-pulse" /> Live</span>
                )}
                {recatProgress?.done && (
                  <span className="text-emerald-600 text-sm flex items-center gap-1 font-sans"><CheckCircle className="size-4" /> Complete</span>
                )}
              </h4>
              {recatProgress?.done && (
                <button
                  onClick={clearRecat}
                  className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>

            {/* Progress bar */}
            {recatProgress && recatProgress.total > 0 && (
              <div className="bg-card shadow-e1 border border-border rounded-xl p-6 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <span>{recatProgress.processed.toLocaleString()} / {recatProgress.total.toLocaleString()} parsed</span>
                    <span className="text-foreground">{Math.round((recatProgress.processed / recatProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-3 bg-secondary border border-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brass rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((recatProgress.processed / recatProgress.total) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Stats chips */}
                <div className="flex gap-4 flex-wrap text-xs font-bold">
                  <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600">
                    <Box className="size-4" /> {recatProgress.processed.toLocaleString()} Checked
                  </span>
                  <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600">
                    <RefreshCw className="size-4" /> {recatProgress.updated.toLocaleString()} Re-assigned
                  </span>
                  <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-muted-foreground">
                    <Check className="size-4" /> {(recatProgress.processed - recatProgress.updated).toLocaleString()} Unchanged
                  </span>
                </div>
              </div>
            )}

            {/* Live log */}
            {recatLogs.length > 0 && (
              <div ref={recatLogsContainerRef} style={{ overflowAnchor: "none" }} className="bg-card border border-border shadow-inner rounded-xl p-5 max-h-[300px] overflow-y-auto overscroll-contain font-mono text-xs font-medium space-y-1.5">
                {recatLogs.map((log, i) => {
                  const Icon = LOG_ICONS[log.type] ?? Tag;
                  return (
                    <div key={i} className="flex items-start gap-3 py-1 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors rounded px-2">
                      <span className="text-muted-foreground/60 w-16 shrink-0 pt-0.5">{log.time}</span>
                      <Icon className="size-4 shrink-0" style={{ color: LOG_COLORS[log.type] ?? "#c9a14a" }} strokeWidth={2.5} />
                      <span style={{ color: LOG_COLORS[log.type] ?? "#c9a14a" }} className="leading-relaxed break-words min-w-0 flex-1">{log.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
