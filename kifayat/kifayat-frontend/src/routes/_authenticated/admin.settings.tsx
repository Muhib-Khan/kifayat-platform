import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { FLAT_DELIVERY_FEE } from "@/lib/cart-store";
import {
  CheckCircle2, ChevronDown, FlaskConical, Key,
  Loader2, Plus, Save, Trash2, Truck, XCircle, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetSettings,
  adminAddGroqKey,
  adminUpdateGroqKey,
  adminDeleteGroqKeyById,
  adminTestGroqKeyById,
  adminUpdateDeliveryFee,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const TASK_OPTIONS = [
  { value: "default",      label: "Default (fallback for all tasks)" },
  { value: "descriptions", label: "Description Doctor" },
  { value: "titles",       label: "Title Optimizer" },
  { value: "reviews",      label: "Review Intelligence" },
  { value: "duplicates",   label: "Duplicate Radar" },
  { value: "seo",          label: "SEO Booster" },
  { value: "pricing",      label: "Price Intelligence" },
  { value: "categories",   label: "Category Fixer" },
];

const TASK_LABEL: Record<string, string> = Object.fromEntries(TASK_OPTIONS.map((o) => [o.value, o.label]));

// ─── Key row ──────────────────────────────────────────────────────────────────
function KeyRow({ entry, onDeleted }: { entry: any; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [editLabel, setEditLabel] = useState(entry.label);
  const [editTask,  setEditTask]  = useState(entry.task);
  const [editing,   setEditing]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const updateMut = useMutation({
    mutationFn: () => adminUpdateGroqKey(entry.id, { label: editLabel, task: editTask }),
    onSuccess: () => { toast.success("Key updated."); setEditing(false); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteGroqKeyById(entry.id),
    onSuccess: () => { toast.success("Key removed."); onDeleted(); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed."),
  });

  const testMut = useMutation({
    mutationFn: () => adminTestGroqKeyById(entry.id),
    onSuccess: (d: any) => { setTestResult({ ok: true,  msg: d?.message ?? "OK" }); toast.success("Connection OK."); },
    onError: (e: any) => { setTestResult({ ok: false, msg: e?.message ?? "Failed" }); toast.error(e?.message ?? "Test failed."); },
  });

  const busy = updateMut.isPending || deleteMut.isPending || testMut.isPending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="border border-border rounded-xl overflow-hidden"
    >
      {/* Main row */}
      <div className="flex items-center gap-4 px-5 py-4 bg-secondary/20">
        <Key className="size-4 text-brass shrink-0" strokeWidth={1.5} />

        {/* Label + task */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="flex-1 min-w-[120px] bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass"
                placeholder="Label"
              />
              <div className="relative">
                <select
                  value={editTask}
                  onChange={(e) => setEditTask(e.target.value)}
                  className="appearance-none bg-background border border-border rounded-lg px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass cursor-pointer"
                >
                  {TASK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">{entry.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{TASK_LABEL[entry.task] ?? entry.task}</p>
            </div>
          )}
        </div>

        {/* Masked key */}
        <code className="hidden sm:block font-mono text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded shrink-0">
          {entry.preview}
        </code>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => updateMut.mutate()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs bg-coal text-bone px-3 py-1.5 rounded-lg hover:bg-brass hover:text-coal transition-colors disabled:opacity-40"
              >
                {updateMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" strokeWidth={1.5} />}
                Save
              </button>
              <button onClick={() => { setEditing(false); setEditLabel(entry.label); setEditTask(entry.task); }} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => testMut.mutate()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40"
                title="Test connection"
              >
                {testMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <FlaskConical className="size-3" strokeWidth={1.5} />}
                Test
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                title="Remove key"
              >
                {deleteMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" strokeWidth={1.5} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Test result */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs border-t ${testResult.ok ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"}`}
          >
            {testResult.ok
              ? <CheckCircle2 className="size-3.5 shrink-0" />
              : <XCircle className="size-3.5 shrink-0" />}
            {testResult.msg}
            <button onClick={() => setTestResult(null)} className="ml-auto text-current/50 hover:text-current">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Add key form ─────────────────────────────────────────────────────────────
function AddKeyForm({ onAdded }: { onAdded: () => void }) {
  const qc = useQueryClient();
  const [open,     setOpen]     = useState(false);
  const [keyVal,   setKeyVal]   = useState("");
  const [label,    setLabel]    = useState("");
  const [task,     setTask]     = useState("default");
  const [showKey,  setShowKey]  = useState(false);

  const addMut = useMutation({
    mutationFn: () => adminAddGroqKey({ key: keyVal.trim(), label: label.trim() || "API Key", task }),
    onSuccess: () => {
      toast.success("Key added.");
      setKeyVal(""); setLabel(""); setTask("default"); setOpen(false);
      onAdded();
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Add failed."),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-dashed border-border px-5 py-3 rounded-xl text-sm text-muted-foreground hover:border-brass hover:text-foreground transition-colors w-full justify-center"
      >
        <Plus className="size-4" strokeWidth={1.5} />
        Add API key
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-brass/30 rounded-xl overflow-hidden bg-brass/[0.03]"
    >
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Plus className="size-4 text-brass" strokeWidth={1.5} />
        <span className="font-medium text-sm">Add new API key</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors text-xs">Cancel</button>
      </div>
      <div className="px-5 py-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main Key, SEO Key…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Designated task</label>
            <div className="relative">
              <select
                value={task}
                onChange={(e) => setTask(e.target.value)}
                className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition cursor-pointer"
              >
                {TASK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">API key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={keyVal}
              onChange={(e) => setKeyVal(e.target.value)}
              placeholder="gsk_••••••••••••••••••••••••••••••"
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 pr-11 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition"
              autoComplete="off" spellCheck={false}
            />
            <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs">
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get keys at{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">
              console.groq.com/keys
            </a>
          </p>
        </div>
        <button
          onClick={() => addMut.mutate()}
          disabled={addMut.isPending || keyVal.trim().length < 8}
          className="inline-flex items-center gap-2 bg-coal text-bone px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brass hover:text-coal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {addMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.5} />}
          Save key
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: adminGetSettings });
  const keys: any[] = data?.settings?.groqKeys ?? [];
  const [, forceUpdate] = useState(0);

  // ── Delivery fee (admin-editable, shown across the storefront) ───────────
  const [feeInput, setFeeInput] = useState<string>(String(FLAT_DELIVERY_FEE));
  useEffect(() => {
    const fee = data?.settings?.deliveryFee;
    if (fee != null) setFeeInput(String(fee));
  }, [data]);

  const feeNumber = Number(feeInput);
  const feeValid = feeInput.trim() !== "" && Number.isFinite(feeNumber) && feeNumber >= 0;

  const saveFeeMut = useMutation({
    mutationFn: () => adminUpdateDeliveryFee(feeNumber),
    onSuccess: () => {
      toast.success("Delivery fee updated.");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed."),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8 max-w-3xl"
    >
      {/* Header */}
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2 text-xs">
          <Zap className="size-3.5 text-brass" /> AI & Integrations
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Settings<span className="text-brass">.</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Add multiple Groq API keys and assign each a dedicated task. Automations run in parallel using their designated key, falling back to the "Default" key if none is assigned.
        </p>
      </div>

      {/* Groq Keys card */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <Key className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Groq API Keys</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each key can be designated to a specific AI Studio task — automations run in parallel using their own key.
            </p>
          </div>
          <span className={`ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            keys.length > 0
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <span className={`size-1.5 rounded-full ${keys.length > 0 ? "bg-emerald-500" : "bg-amber-400"}`} />
            {isLoading ? "…" : keys.length > 0 ? `${keys.length} key${keys.length > 1 ? "s" : ""}` : "None set"}
          </span>
        </div>

        <div className="px-6 py-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-secondary/50 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {keys.map((k) => (
                <KeyRow
                  key={k.id}
                  entry={k}
                  onDeleted={() => qc.invalidateQueries({ queryKey: ["admin-settings"] })}
                />
              ))}
            </AnimatePresence>
          )}

          <AddKeyForm onAdded={() => forceUpdate((n) => n + 1)} />
        </div>
      </div>

      {/* Delivery fee card */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <Truck className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Delivery Fee</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Flat fee charged on every order — shown across the storefront (banner, cart, checkout and product pages).
            </p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <label className="text-xs font-medium text-muted-foreground">Delivery Fee (Rs)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="100"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition"
            />
            <p className="text-xs text-muted-foreground">
              Storefront default: Rs 100 — updates instantly for all visitors once saved.
            </p>
          </div>
          <button
            onClick={() => saveFeeMut.mutate()}
            disabled={!feeValid || saveFeeMut.isPending}
            className="inline-flex items-center gap-2 bg-coal text-bone px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brass hover:text-coal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveFeeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.5} />}
            Save delivery fee
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-secondary/40 border border-border rounded-xl px-6 py-5 space-y-4">
        <p className="text-sm font-medium flex items-center gap-2">
          <Zap className="size-4 text-brass" strokeWidth={1.5} />
          How task designation works
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: "Default key",    desc: "Used as fallback when no task-specific key is set." },
            { label: "Task keys",      desc: "Each automation pulls its own designated key, enabling true parallel execution." },
            { label: "Fallback chain", desc: "Task key → Default key → First available key → env GROQ_API_KEY." },
            { label: "Parallel runs",  desc: "Two background jobs with separate keys run simultaneously without rate-limiting each other." },
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 size-1.5 rounded-full bg-brass shrink-0" />
              <div>
                <span className="font-medium">{row.label}</span>
                <span className="text-muted-foreground"> — {row.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
