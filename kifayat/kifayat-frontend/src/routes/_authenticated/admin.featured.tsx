import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDown, ArrowUp, Check, Image as ImageIcon, Inbox, Loader2,
  Plus, Save, Search, Star, Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetFeaturedLandingOrdered,
  adminListProductsPaginated,
  adminSaveFeaturedOrder,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/featured")({
  component: FeaturedOrderPage,
});

type FeaturedProduct = {
  _id: string;
  name: string;
  imageUrl: string | null;
  featuredOrder: number | null;
};

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition";

function FeaturedOrderPage() {
  const qc = useQueryClient();

  // ── Load the current featured products (sorted by featuredOrder, nulls last) ──
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "featured-order"],
    queryFn: adminGetFeaturedLandingOrdered,
  });

  const [order, setOrder] = useState<FeaturedProduct[]>([]);
  useEffect(() => {
    const sorted = [...(data ?? [])].sort((a, b) => {
      if (a.featuredOrder == null && b.featuredOrder == null) return 0;
      if (a.featuredOrder == null) return 1;
      if (b.featuredOrder == null) return -1;
      return a.featuredOrder - b.featuredOrder;
    });
    setOrder(sorted);
  }, [data]);

  const orderIds = new Set(order.map((p) => p._id));

  // ── Save the current display order ──────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (orderIds: string[]) => adminSaveFeaturedOrder(orderIds),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Featured order saved.");
      qc.invalidateQueries({ queryKey: ["admin", "featured-order"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed."),
  });

  const handleSave = () => {
    if (order.length === 0) {
      toast.error("Add at least one product first.");
      return;
    }
    saveMut.mutate(order.map((p) => p._id));
  };

  // ── Local reordering helpers ─────────────────────────────────────────────────
  // Per-row draft of the typed "move to position" value. Inputs show the live
  // position until the admin types, and drafts are cleared after any reorder so
  // the fields never display a stale number.
  const [draftPos, setDraftPos] = useState<Record<string, string>>({});
  const clearDrafts = () => setDraftPos({});

  // Move a product straight to a typed position (1–80). A target beyond the
  // current list length lands it at the end, matching a physical reorder.
  const applyPos = (id: string) => {
    const raw = draftPos[id];
    if (raw === undefined || raw === "") return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 80) {
      toast.error("Position must be a whole number from 1 to 80.");
      setDraftPos((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      return;
    }
    setOrder((prev) => {
      const from = prev.findIndex((p) => p._id === id);
      if (from < 0) return prev;
      const targetIndex = Math.min(Math.max(n - 1, 0), prev.length - 1);
      if (from === targetIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    clearDrafts();
  };

  const move = (idx: number, dir: -1 | 1) => {
    clearDrafts();
    setOrder((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeAt = (idx: number) => {
    clearDrafts();
    setOrder((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Add products — search then pick ──────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    const q = searchTerm.trim();
    if (!q) {
      toast.error("Enter a search term first.");
      return;
    }
    setSearching(true);
    try {
      const res = await adminListProductsPaginated({ page: 1, limit: 50, search: q });
      setResults(res.products ?? []);
      setSearched(true);
      if ((res.products ?? []).length === 0) toast.error("No products match that search.");
    } catch (e: any) {
      toast.error(e?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const addProduct = (p: any) => {
    setOrder((prev) =>
      prev.some((o) => o._id === p.id)
        ? prev
        : [...prev, { _id: p.id, name: p.name, imageUrl: p.image_url ?? null, featuredOrder: null }],
    );
  };

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
          <Star className="size-3.5 text-brass" /> Curated picks
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Featured Order<span className="text-brass">.</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Choose the display order of featured products on the landing page — position 1 shows
          first. Reorder with the arrows, type a position (1–80) to jump a product there, or
          remove a product from the order. Removed products stay featured but appear after the
          ordered ones.
        </p>
      </div>

      {/* ── Add products ─────────────────────────────────────────────────────── */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-e1">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <Search className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Add products</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search your catalog and pick results to append to the order.
            </p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              placeholder="Search product name…"
              className={inputClass}
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="px-5 py-2.5 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-brass hover:text-coal transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" strokeWidth={1.5} />}
              Search
            </button>
          </div>

          {searching ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !searched ? (
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <Search className="size-7 text-muted-foreground/40 mb-2.5" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">Search results appear here.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <Inbox className="size-7 text-muted-foreground/40 mb-2.5" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">No products match.</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {results.map((p) => {
                const added = orderIds.has(p.id);
                return (
                  <div key={p.id} className="px-4 py-3.5 flex items-center gap-3.5">
                    <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-border bg-secondary/40 grid place-items-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-4 text-muted-foreground/50" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{p.name}</p>
                      <p className="text-xs font-bold text-brass mt-0.5">
                        Rs {p.price.toLocaleString("en-PK")}
                      </p>
                    </div>
                    <button
                      onClick={() => addProduct(p)}
                      disabled={added}
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors disabled:cursor-default shrink-0 ${
                        added
                          ? "bg-brass/10 text-brass border border-brass/25"
                          : "bg-coal text-bone hover:bg-brass hover:text-coal"
                      }`}
                    >
                      {added ? <Check className="size-3.5" strokeWidth={2} /> : <Plus className="size-3.5" strokeWidth={2} />}
                      {added ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Current order ─────────────────────────────────────────────────────── */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-e1">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <Star className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Display order</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.length} product{order.length === 1 ? "" : "s"} · position 1 shows first
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending || order.length === 0}
            className="ml-auto shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-brass hover:text-coal transition-colors disabled:opacity-50"
          >
            {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.5} />}
            Save Order
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : order.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-foreground">No featured products yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Search above and add products to build the display order.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {order.map((p, i) => {
              const img = (p.imageUrl ?? "").split(",")[0].split("?")[0].trim();
              return (
                <div key={p._id} className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 sm:gap-4">
                  <span className="shrink-0 inline-flex items-center justify-center size-9 rounded-lg bg-brass/10 text-brass border border-brass/25 eyebrow text-[10px]">
                    {i + 1}
                  </span>
                  <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-border bg-secondary/40 grid place-items-center">
                    {img ? (
                      <img src={img} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-4 text-muted-foreground/50" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                      Position {i + 1}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <span>Pos</span>
                    <input
                      type="number"
                      min={1}
                      max={80}
                      inputMode="numeric"
                      value={draftPos[p._id] ?? String(i + 1)}
                      onChange={(e) =>
                        setDraftPos((d) => ({ ...d, [p._id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          applyPos(p._id);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={() => applyPos(p._id)}
                      aria-label={`Move ${p.name} to position`}
                      title="Jump to position (1–80)"
                      className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-brass/40 focus:border-brass transition"
                    />
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                      className="size-8 flex items-center justify-center border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ArrowUp className="size-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1}
                      title="Move down"
                      className="size-8 flex items-center justify-center border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ArrowDown className="size-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => removeAt(i)}
                      title="Remove from order"
                      aria-label="Remove from order"
                      className="size-8 flex items-center justify-center border border-border text-muted-foreground rounded-lg hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
