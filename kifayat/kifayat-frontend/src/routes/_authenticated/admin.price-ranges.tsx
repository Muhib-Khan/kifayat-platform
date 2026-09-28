import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, History, Loader2, Package, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminCreatePriceRange,
  adminDeletePriceRange,
  adminGetPriceRangeProducts,
  adminGetPriceRanges,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/price-ranges")({
  component: PriceRangesPage,
});

type PriceRange = {
  _id: string;
  minPrice: number;
  maxPrice: number;
  profitMargin: number;
  createdAt?: string;
};

const inputClass =
  "w-full px-4 py-3 bg-background border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-brass focus:ring-2 focus:ring-brass/30 transition-all";

function PriceRangesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "price-ranges"],
    queryFn: adminGetPriceRanges,
  });

  const ranges: PriceRange[] = data?.priceRanges ?? [];

  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [marginInput, setMarginInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Products affected by the currently expanded range (fetched from the server
  // on open — matches the resolver's inclusive minPrice..maxPrice match).
  const { data: rangeProducts, isLoading: rangeProductsLoading } = useQuery({
    queryKey: ["admin", "price-ranges", expandedId, "products"],
    queryFn: () => adminGetPriceRangeProducts(expandedId as string),
    enabled: !!expandedId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "price-ranges"] });
  };

  const createMut = useMutation({
    mutationFn: (payload: { minPrice: number; maxPrice: number; profitMargin: number }) =>
      adminCreatePriceRange(payload),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Price range saved.");
      setMinInput("");
      setMaxInput("");
      setMarginInput("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeletePriceRange(id),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Price range deleted.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed."),
  });

  const handleSave = () => {
    const minPrice = parseFloat(minInput);
    const maxPrice = parseFloat(maxInput);
    const profitMargin = parseFloat(marginInput);
    if (isNaN(minPrice) || isNaN(maxPrice) || isNaN(profitMargin)) {
      toast.error("Enter valid numbers for all three fields.");
      return;
    }
    if (minPrice < 0) {
      toast.error("Minimum price must be 0 or greater.");
      return;
    }
    if (maxPrice <= minPrice) {
      toast.error("Maximum price must be greater than the minimum price.");
      return;
    }
    if (profitMargin < 0) {
      toast.error("Profit margin must be 0 or greater.");
      return;
    }
    createMut.mutate({ minPrice, maxPrice, profitMargin });
  };

  const handleDelete = (r: PriceRange) => {
    if (!window.confirm(`Delete price range ${r.minPrice} - ${r.maxPrice}?`)) return;
    deleteMut.mutate(r._id);
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
          <SlidersHorizontal className="size-3.5 text-brass" /> Catalog pricing
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Price Ranges<span className="text-brass">.</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Define the wholesale→retail profit margin applied to products that fall inside each
          price band. New ranges are checked against the saved history below.
        </p>
      </div>

      {/* Create range card */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-e1">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <SlidersHorizontal className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">New price range</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Products whose wholesale price sits between Min and Max get this margin.
            </p>
          </div>
        </div>
        <div className="px-6 py-6 space-y-5 max-w-2xl">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Minimum Price
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 0"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Maximum Price
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 5000"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Profit Margin (%)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 25"
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={createMut.isPending}
            className="px-6 py-3 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-brass hover:text-coal transition-colors disabled:opacity-50 flex items-center gap-2 shadow-e1"
          >
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.5} />}
            Save
          </button>
        </div>
      </div>

      {/* Saved ranges (history) */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-e1">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <History className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Saved price ranges</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ranges.length} range{ranges.length === 1 ? "" : "s"} · oldest first
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : ranges.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-foreground">No price ranges yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Save your first range above and it will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ranges.map((r) => {
              const expanded = expandedId === r._id;
              return (
                <div key={r._id}>
                  <div className="px-6 py-4 flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => setExpandedId(expanded ? null : r._id)}
                      title={expanded ? "Hide affected products" : "Show affected products"}
                      className="shrink-0 flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      {expanded ? <ChevronDown className="size-4" strokeWidth={1.5} /> : <ChevronRight className="size-4" strokeWidth={1.5} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">
                        {r.minPrice} - {r.maxPrice}
                        <span className="text-brass ml-2">→ {r.profitMargin}%</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.createdAt ? `Saved ${new Date(r.createdAt).toLocaleString()}` : "\u00A0"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deleteMut.isPending}
                      title="Delete range"
                      className="inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {deleteMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" strokeWidth={1.5} />}
                      Delete
                    </button>
                  </div>
                  {expanded && (
                    <div className="px-6 pb-4">
                      <div className="bg-secondary/20 rounded-xl p-3 border border-border">
                        {rangeProductsLoading ? (
                          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" /> Loading affected products…
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              {rangeProducts?.count ?? 0} product{rangeProducts?.count === 1 ? "" : "s"} affected
                            </p>
                            {rangeProducts?.count === 0 ? (
                              <p className="text-xs text-muted-foreground/70">No products in this range.</p>
                            ) : (
                              <div className="max-h-72 overflow-y-auto space-y-1.5">
                                {rangeProducts?.products.map((p: any) => (
                                  <div key={p._id} className="flex items-center gap-3 min-w-0 bg-card rounded-lg px-2 py-1.5 border border-border">
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl.split(",")[0].split("?")[0].trim()} alt={p.name} className="size-8 object-cover bg-secondary border border-border shrink-0 rounded-lg shadow-sm" />
                                    ) : (
                                      <div className="size-8 bg-secondary border border-border shrink-0 rounded-lg flex items-center justify-center shadow-sm">
                                        <Package className="size-3.5 text-muted-foreground" />
                                      </div>
                                    )}
                                    <span className="text-xs font-medium text-foreground truncate min-w-0 flex-1">{p.name}</span>
                                    <span className="text-xs font-mono text-muted-foreground whitespace-nowrap shrink-0">
                                      {p.wholesalePrice} → {p.retailPrice}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
