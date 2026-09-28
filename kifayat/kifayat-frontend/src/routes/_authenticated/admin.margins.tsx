import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BadgePercent, CheckCircle2, Loader2, Save, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetCategoryPricing,
  adminUpdatePricingAll,
  adminUpdatePricingByCategory,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/margins")({
  component: ProfitMarginsPage,
});

type CategoryRow = {
  name: string;
  productCount: number;
  markup: number | null;
};

function ProfitMarginsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "category-pricing"],
    queryFn: adminGetCategoryPricing,
  });

  const categories: CategoryRow[] = data?.categories ?? [];
  const savedPricing: Record<string, number> = data?.pricing ?? {};
  const savedGlobal = data?.globalPricing ?? null;

  const [globalInput, setGlobalInput] = useState("");
  useEffect(() => {
    if (savedGlobal != null) setGlobalInput(String(savedGlobal));
  }, [savedGlobal]);

  const [catInputs, setCatInputs] = useState<Record<string, string>>({});
  useEffect(() => {
    setCatInputs((prev) => {
      const next = { ...prev };
      categories.forEach((c) => {
        if (next[c.name] === undefined && savedPricing[c.name] != null) {
          next[c.name] = String(savedPricing[c.name]);
        }
      });
      return next;
    });
  }, [categories, savedPricing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "category-pricing"] });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
  };

  const globalMut = useMutation({
    mutationFn: (pct: number) => adminUpdatePricingAll(pct),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Global markup applied.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const catMut = useMutation({
    mutationFn: ({ category, pct }: { category: string; pct: number }) =>
      adminUpdatePricingByCategory(category, pct),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Category markup updated.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const handleGlobal = () => {
    const pct = parseFloat(globalInput);
    if (isNaN(pct) || pct < 0) {
      toast.error("Enter a valid percentage (e.g. 25).");
      return;
    }
    if (!window.confirm(`Apply +${pct}% markup to ALL products?`)) return;
    globalMut.mutate(pct);
  };

  const handleCat = (name: string) => {
    const raw = catInputs[name] ?? "";
    const pct = parseFloat(raw);
    if (isNaN(pct) || pct < 0) {
      toast.error(`Enter a valid percentage for "${name}".`);
      return;
    }
    if (!window.confirm(`Apply +${pct}% markup to all "${name}" products?`)) return;
    catMut.mutate({ category: name, pct });
  };

  const effective = (row: CategoryRow): number | null =>
    savedPricing[row.name] ?? savedGlobal ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2 text-xs">
          <BadgePercent className="size-3.5 text-brass" /> Catalog pricing
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Profit Margins<span className="text-brass">.</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Set the wholesale→retail markup per category. Saved values are applied to every new CSV import,
          and applying a value also re-prices existing products in that category on the spot.
        </p>
      </div>

      {/* Global default card */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-e1">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <TrendingUp className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Global default markup</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fallback % used for any category without a specific override.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-secondary/80 text-muted-foreground border border-border">
            {savedGlobal != null ? `+${savedGlobal}%` : "Not set"}
          </span>
        </div>
        <div className="px-6 py-6 space-y-4 max-w-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              min={0}
              placeholder="e.g. 25"
              value={globalInput}
              onChange={(e) => setGlobalInput(e.target.value)}
              className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-brass focus:ring-2 focus:ring-brass/30 transition-all"
            />
            <button
              onClick={handleGlobal}
              disabled={globalMut.isPending}
              className="px-6 py-3 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-brass hover:text-coal transition-colors disabled:opacity-50 flex items-center gap-2 shadow-e1"
            >
              {globalMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.5} />}
              Apply to All
            </button>
          </div>
        </div>
      </div>

      {/* Per-category list */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-e1">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <BadgePercent className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Per-category markup</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {categories.length} categories · made with{" "}
              {savedGlobal != null ? "global " : "Saved"} default{" "}
              {savedGlobal != null && <span className="text-brass">+{savedGlobal}%</span>}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-foreground">No categories yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Categories appear once products are uploaded.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {categories.map((row) => {
                const eff = effective(row);
                return (
                  <motion.div
                    key={row.name}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{row.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.productCount} product{row.productCount === 1 ? "" : "s"}
                        {eff != null && <span className="text-brass ml-2">+{eff}% effective</span>}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder={savedGlobal != null ? String(savedGlobal) : "%"}
                      value={catInputs[row.name] ?? ""}
                      onChange={(e) => setCatInputs((p) => ({ ...p, [row.name]: e.target.value }))}
                      className="w-24 px-3 py-2 bg-background border border-border rounded-lg text-sm font-bold text-foreground text-center focus:outline-none focus:border-brass focus:ring-2 focus:ring-brass/30 transition-all"
                    />
                    <button
                      onClick={() => handleCat(row.name)}
                      disabled={catMut.isPending}
                      className="px-5 py-2.5 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-brass hover:text-coal transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {catMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.5} />}
                      Apply
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-secondary/40 border border-border rounded-2xl px-6 py-5 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="size-4 text-brass" strokeWidth={1.5} />
          How markup landing works
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: "Priority",    desc: "Category % beats the global default when both are set." },
            { label: "On import",   desc: "Saved percentages apply automatically to new CSV rows with a wholesale cost." },
            { label: "On apply",    desc: "Hitting Apply re-prices every product in that category immediately." },
            { label: "No cost data", desc: "Products without a wholesale price are skipped — retail is never zeroed." },
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