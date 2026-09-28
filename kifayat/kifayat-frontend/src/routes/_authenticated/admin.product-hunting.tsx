import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetFeaturedLandingProducts,
  adminGetFeaturedCount,
  adminHuntProducts,
  adminSetHeroObjects,
  adminToggleFeaturedOnLanding,
} from "@/lib/admin.functions";
import { getHeroObjects, getProductById, listCategories } from "@/lib/shop.functions";
import { normalizeProduct, type UIProduct } from "@/lib/api";
import { Check, ChevronDown, Image, Inbox, Loader2, MoveLeft, MoveRight, Package, Plus, Search, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PanelTableSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/product-hunting")({
  component: ProductHunting,
});

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition";

function ProductHunting() {
  const qc = useQueryClient();

  // ── Search state (name debounced ~400ms, category applies instantly) ────
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasQuery = debouncedSearch.trim() !== "" || category !== "";

  // ── Categories for the dropdown (slug matches the ?category= param) ─────
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: listCategories,
  });

  // ── Hunt results ──────────────────────────────────────────────────────────
  const { data: hunt, isLoading: huntLoading } = useQuery({
    queryKey: ["admin", "hunt", debouncedSearch.trim(), category],
    queryFn: () => adminHuntProducts({ search: debouncedSearch, category }),
    enabled: hasQuery,
    placeholderData: (prev) => prev,
  });
  const huntProducts = hunt?.products ?? [];

  // ── Featured list + count (same keys the Products page keeps fresh) ─────
  const { data: featuredRaw, isLoading: featuredLoading } = useQuery({
    queryKey: ["admin", "featured-landing"],
    queryFn: adminGetFeaturedLandingProducts,
  });
  const featured: UIProduct[] = (featuredRaw ?? []).map(normalizeProduct);
  const featuredIds = new Set(featured.map((f) => f.id));

  const { data: featuredCount = featured.length } = useQuery({
    queryKey: ["admin", "featured-count"],
    queryFn: adminGetFeaturedCount,
  });

  const refreshFeatured = () => {
    qc.invalidateQueries({ queryKey: ["admin", "featured-landing"] });
    qc.invalidateQueries({ queryKey: ["admin", "featured-count"] });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["admin", "hunt"] });
  };

  // ── Add to main page ──────────────────────────────────────────────────────
  const addMut = useMutation({
    mutationFn: ({ id }: { id: string }) => adminToggleFeaturedOnLanding(id, true),
    onSuccess: () => {
      toast.success("Added to the main page.");
      refreshFeatured();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add to main page."),
  });

  // ── Unfeature ────────────────────────────────────────────────────────────
  const unfeatureMut = useMutation({
    mutationFn: ({ id }: { id: string }) => adminToggleFeaturedOnLanding(id, false),
    onSuccess: () => {
      toast.success("Removed from the main page.");
      refreshFeatured();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update."),
  });

  // ── Objects Considered (hero diptych) ─────────────────────────────────────
  const { data: heroCfg = { left: null, right: null } } = useQuery({
    queryKey: ["admin", "hero-objects"],
    queryFn: getHeroObjects,
  });

  const { data: heroLeftProduct, isLoading: heroLeftLoading } = useQuery({
    queryKey: ["admin", "hero-object-product", heroCfg.left ?? null],
    queryFn: () => (heroCfg.left ? getProductById(heroCfg.left) : Promise.resolve(null)),
    enabled: !!heroCfg.left,
  });

  const { data: heroRightProduct, isLoading: heroRightLoading } = useQuery({
    queryKey: ["admin", "hero-object-product", heroCfg.right ?? null],
    queryFn: () => (heroCfg.right ? getProductById(heroCfg.right) : Promise.resolve(null)),
    enabled: !!heroCfg.right,
  });

  const heroMut = useMutation({
    mutationFn: ({ left, right }: { left: string | null; right: string | null }) =>
      adminSetHeroObjects({ left, right }),
    onSuccess: () => {
      toast.success("Hero objects saved.");
      qc.invalidateQueries({ queryKey: ["admin", "hero-objects"] });
      qc.invalidateQueries({ queryKey: ["hero"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save hero objects."),
  });

  const setHeroSlot = (slot: "left" | "right", id: string | null) => {
    const next = {
      left: slot === "left" ? id : heroCfg.left,
      right: slot === "right" ? id : heroCfg.right,
    };
    heroMut.mutate(next);
  };

  const isHeroSlot = (p: UIProduct, slot: "left" | "right") =>
    heroCfg[slot] === p.id;

  // A result counts as already-added if the backend says so, or if it is in
  // the currently featured list (covers stale cache edge cases).
  const isFeatured = (p: UIProduct) => p.featuredOnLanding === true || featuredIds.has(p.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass"></span> Product Hunting
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Product Hunting<span className="text-brass">.</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Find existing products and put them on the main page (Curated Picks). Search by name or
          browse a category, then hit Add — no manual entry needed. Remove anything you no longer
          want shown.
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <Search className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Find a product</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search by name or narrow down by category. Results refresh as you type.
            </p>
          </div>
        </div>
        <div className="px-6 py-5 grid sm:grid-cols-[1fr_240px] gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search product name, SKU or category…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brass/30 focus:border-brass transition cursor-pointer"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                  {c.productCount ? ` (${c.productCount})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Objects Considered (Hero) ───────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
          <Sparkles className="size-4 text-brass shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Objects Considered <span className="text-muted-foreground font-normal">(hero)</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The two products shown in the home-page diptych. Pick them from the results below
              with the left/right buttons — removed here reverts to the default selection.
            </p>
          </div>
          {heroMut.isPending && (
            <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-brass/10 text-brass border border-brass/25">
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </span>
          )}
        </div>
        <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
          {(["left", "right"] as const).map((slot, i) => {
            const product = slot === "left" ? heroLeftProduct : heroRightProduct;
            const loading = slot === "left" ? heroLeftLoading : heroRightLoading;
            const set = heroCfg[slot];
            return (
              <div key={slot} className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center gap-4">
                <span className="shrink-0 inline-flex items-center justify-center size-9 rounded-lg bg-brass/10 text-brass border border-brass/25 eyebrow text-[10px]">
                  0{i + 1}
                </span>
                {loading ? (
                  <div className="flex-1 grid grid-cols-[3rem_1fr] items-center gap-3">
                    <div className="size-12 animate-pulse bg-border rounded-lg" />
                    <div className="space-y-2">
                      <div className="h-3 w-3/4 animate-pulse bg-border rounded" />
                      <div className="h-3 w-1/3 animate-pulse bg-border rounded" />
                    </div>
                  </div>
                ) : product ? (
                  <>
                    <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-border bg-secondary/40 grid place-items-center">
                      <img src={product.image_url ?? ""} alt="" loading="lazy" className="size-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
                        {slot === "left" ? "Left" : "Right"} slot
                      </p>
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mt-0.5">{product.name}</p>
                      <p className="text-xs font-bold text-brass mt-0.5">
                        Rs {product.price.toLocaleString("en-PK")}
                      </p>
                    </div>
                    <button
                      onClick={() => setHeroSlot(slot, null)}
                      disabled={heroMut.isPending}
                      title={`Remove from ${slot} slot`}
                      className="size-8 shrink-0 flex items-center justify-center border border-border text-muted-foreground rounded-lg hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-500 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
                      {slot === "left" ? "Left" : "Right"} slot
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-snug">
                      {set ? "Product no longer exists." : "No product set — showing the default pick."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* ── Results ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 border border-border rounded-xl overflow-hidden bg-card">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
            <Package className="size-4 text-brass shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Results</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Matches appear here as you search.
              </p>
            </div>
            {hasQuery && !huntLoading && (
              <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-brass/10 text-brass border border-brass/25">
                <span className="size-1.5 rounded-full bg-brass" />
                {hunt?.total ?? 0} found
              </span>
            )}
          </div>

          {huntLoading ? (
            <div className="p-4">
              <PanelTableSkeleton rows={6} cols={2} header={false} />
            </div>
          ) : !hasQuery ? (
            <div className="px-6 py-14 flex flex-col items-center text-center">
              <Search className="size-8 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">Search for a product to get started.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Type a name or pick a category — matches appear here.
              </p>
            </div>
          ) : huntProducts.length === 0 ? (
            <div className="px-6 py-14 flex flex-col items-center text-center">
              <Inbox className="size-8 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">No products match.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try a different name or category.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {huntProducts.map((p) => (
                  <div key={p.id} className="px-4 py-3.5 flex items-center gap-3.5">
                    <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-border bg-secondary/40 grid place-items-center">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Image className="size-4 text-muted-foreground/50" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
                        {p.category_name ?? "Uncategorized"}
                      </p>
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mt-0.5">
                        {p.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs font-bold text-brass">
                          Rs {p.price.toLocaleString("en-PK")}
                        </span>
                        {!p.inStock && (
                          <span className="text-[10px] font-semibold text-red-500/80">
                            Out of stock
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setHeroSlot("left", p.id)}
                        disabled={heroMut.isPending}
                        title={isHeroSlot(p, "left") ? "Currently the left hero object — click to keep" : "Set as left hero object"}
                        className={`size-8 flex items-center justify-center rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isHeroSlot(p, "left")
                            ? "border-brass bg-brass/20 text-brass"
                            : "border-border text-muted-foreground hover:text-brass hover:border-brass/40"
                        }`}
                      >
                        {heroMut.isPending && heroMut.variables?.left === p.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <MoveLeft className="size-3.5" strokeWidth={2} />
                        )}
                      </button>
                      <button
                        onClick={() => setHeroSlot("right", p.id)}
                        disabled={heroMut.isPending}
                        title={isHeroSlot(p, "right") ? "Currently the right hero object — click to keep" : "Set as right hero object"}
                        className={`size-8 flex items-center justify-center rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isHeroSlot(p, "right")
                            ? "border-brass bg-brass/20 text-brass"
                            : "border-border text-muted-foreground hover:text-brass hover:border-brass/40"
                        }`}
                      >
                        {heroMut.isPending && heroMut.variables?.right === p.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <MoveRight className="size-3.5" strokeWidth={2} />
                        )}
                      </button>
                      {isFeatured(p) ? (
                        <span
                          title="Already on the main page"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-brass/30 bg-brass/10 text-brass"
                        >
                          <Check className="size-3.5" strokeWidth={2} /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => addMut.mutate({ id: p.id })}
                          disabled={addMut.isPending}
                          title="Add to main page"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-brass/40 bg-brass/10 text-brass hover:bg-brass/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {addMut.isPending && addMut.variables?.id === p.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Plus className="size-3.5" strokeWidth={2} />
                          )}
                          {addMut.isPending && addMut.variables?.id === p.id ? "Adding…" : "Add"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hunt && hunt.total > huntProducts.length && (
                <p className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground">
                  Showing the first {huntProducts.length} of {hunt.total} matches — narrow the
                  search to find more.
                </p>
              )}
            </>
          )}
        </div>

        {/* ── On the main page ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-24 border border-border rounded-xl overflow-hidden bg-card">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/30">
            <Target className="size-4 text-brass shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">On the main page</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Curated Picks — what shoppers see on the home page.
              </p>
            </div>
            <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-brass/10 text-brass border border-brass/25">
              <span className="size-1.5 rounded-full bg-brass" />
              {featuredLoading ? "…" : `${featuredCount} live`}
            </span>
          </div>

          {featuredLoading ? (
            <div className="p-4">
              <PanelTableSkeleton rows={5} cols={2} header={false} />
            </div>
          ) : featured.length === 0 ? (
            <div className="px-6 py-14 flex flex-col items-center text-center">
              <Inbox className="size-8 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                No products featured on the main page yet.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Search above and add one — it appears here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {featured.map((p) => (
                <div key={p.id} className="px-4 py-3.5 flex items-center gap-3.5">
                  <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-border bg-secondary/40 grid place-items-center">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Image className="size-4 text-muted-foreground/50" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
                      {p.category_name ?? "Uncategorized"}
                    </p>
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mt-0.5">
                      {p.name}
                    </p>
                    <p className="text-xs font-bold text-brass mt-0.5">
                      Rs {p.price.toLocaleString("en-PK")}
                    </p>
                  </div>
                  <button
                    onClick={() => unfeatureMut.mutate({ id: p.id })}
                    disabled={unfeatureMut.isPending}
                    title="Remove from main page"
                    className="size-8 shrink-0 flex items-center justify-center border border-brass/40 bg-brass/10 text-brass rounded-lg hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-500 transition-all disabled:opacity-50"
                  >
                    {unfeatureMut.isPending && unfeatureMut.variables?.id === p.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Target className="size-3.5" strokeWidth={2} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
