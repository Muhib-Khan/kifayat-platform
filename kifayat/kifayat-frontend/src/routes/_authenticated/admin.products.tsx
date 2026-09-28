import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminListProductsPaginated,
  adminDeleteProduct,
  adminUploadProductCSV,
  adminClearProducts,
  adminGetCategoryPricing,
  adminUpdatePricingAll,
  adminUpdatePricingByCategory,
  adminUpdateProduct,
  adminGetProductOrders,
  adminDownloadCSV,
  adminGetCSVQueueCount,
  adminToggleFeaturedOnLanding,
  adminGetFeaturedCount,
  adminFetchProductDynamicData,
  adminUpdateProductManualPosition,
  adminUpdateBulkManualPositions,
  adminClearAllManualPositions,
} from "@/lib/admin.functions";
import { Trash, ExternalLink, Upload, Eye, EyeOff, Edit2, Package, Inbox, Loader2, X, Download, Save, Box, Percent, TrendingUp, ChevronDown, CheckCircle, RefreshCw, Search, ChevronLeft, ChevronRight, Target, Database, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelTableSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProducts,
});

// ─── Product Edit Modal ──────────────────────────────────────────────────────
function ProductEditModal({
  product,
  onClose,
  onSaved,
}: {
  product: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name ?? "",
    description: product.description ?? "",
    stock: product.stock ?? 0,
    weight: product.weight ?? 0,
    retailPrice: product.retailPrice ?? product.price ?? 0,
    wholesalePrice: product.wholesalePrice ?? 0,
    imageUrl: product.imageUrl ?? product.image_url ?? "",
    videoUrl: product.videoUrl ?? "",
    manualPosition: product.manualPosition ?? "",
    keywords: Array.isArray(product.keywords) ? (product.keywords as string[]).join(", ") : "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productId = product._id ?? product.id;
  const wholesale = Number(form.wholesalePrice) || 0;
  const retail = Number(form.retailPrice) || 0;
  const markup = wholesale > 0 ? ((retail - wholesale) / wholesale) * 100 : 0;
  const markupColor = markup > 0 ? "#10b981" : markup < 0 ? "#ef4444" : "#64748b";

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updateData: any = {
        name: form.name,
        description: form.description,
        stock: Number(form.stock),
        weight: Number(form.weight),
        retailPrice: Number(form.retailPrice),
        wholesalePrice: Number(form.wholesalePrice),
        imageUrl: form.imageUrl,
        videoUrl: form.videoUrl,
      };

      // Only include manualPosition if it's a valid number
      if (form.manualPosition !== "" && !isNaN(Number(form.manualPosition))) {
        updateData.manualPosition = Number(form.manualPosition);
      }

      // Per-product SEO — keywords comma-separated → array. seoTitle/seoDescription
      // are optional (the product page falls back to name/description when blank).
      updateData.keywords = form.keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      updateData.seoTitle = form.seoTitle.trim();
      updateData.seoDescription = form.seoDescription.trim();

      await adminUpdateProduct(productId, updateData);
      setSuccess("Product saved successfully.");
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await adminDeleteProduct(productId);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const textFields: { label: string; key: keyof typeof form; type: string }[] = [
    { label: "Name", key: "name", type: "text" },
    { label: "Description", key: "description", type: "textarea" },
    { label: "Stock", key: "stock", type: "number" },
    { label: "Weight (kg)", key: "weight", type: "number" },
    { label: "Image URL", key: "imageUrl", type: "text" },
    { label: "Video URL", key: "videoUrl", type: "text" },
    { label: "Manual Position", key: "manualPosition", type: "number" },
    { label: "SEO Keywords (comma-separated)", key: "keywords", type: "text" },
    { label: "SEO Title (optional)", key: "seoTitle", type: "text" },
    { label: "SEO Description (optional)", key: "seoDescription", type: "textarea" },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card shadow-e3 border border-border rounded-2xl p-6 sm:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-foreground text-xl font-display font-bold flex items-center gap-2">
            <Edit2 className="size-5 text-brass" /> Edit Product
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        <div className="bg-secondary/50 rounded-lg px-4 py-3 mb-6 flex justify-between items-center text-sm border border-border">
          <span className="text-muted-foreground font-semibold">Product ID</span>
          <span className="font-mono font-bold text-foreground">{productId}</span>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg px-4 py-3 mb-5 text-sm font-medium">{error}</div>}
        {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-lg px-4 py-3 mb-5 text-sm font-medium">{success}</div>}

        <div className="space-y-5">
          {textFields.map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-muted-foreground text-[11px] uppercase tracking-widest font-bold mb-2">{label}</label>
              {type === "textarea" ? (
                <textarea
                  value={form[key] as string}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm resize-y focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-shadow shadow-sm"
                />
              ) : (
                <input
                  type={type}
                  value={form[key] as string}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-shadow shadow-sm"
                />
              )}
            </div>
          ))}

          <p className="text-xs text-muted-foreground/80 leading-relaxed -mt-1">
            SEO Keywords make this product appear in site search. Type phrases customers use — e.g.{" "}
            <span className="font-semibold text-foreground/80">Best Hand Gripper</span>, hand gripper, grip
            trainer. SEO Title/Description (optional) override the page title &amp; meta description.
          </p>
          <div className="bg-secondary/30 rounded-xl p-5 border border-border space-y-4 mt-2">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">Pricing</p>
              <span className="text-xs font-bold px-2 py-1 rounded-md border" style={{ color: markupColor, borderColor: markupColor + "40", background: markupColor + "10" }}>
                {markup > 0 ? "+" : ""}{markup.toFixed(1)}% markup
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-muted-foreground text-[11px] font-bold uppercase tracking-widest mb-2">Wholesale (PKR)</label>
                <input
                  type="number"
                  value={form.wholesalePrice}
                  onChange={(e) => setForm((p) => ({ ...p, wholesalePrice: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm font-bold focus:outline-none focus:border-brass transition-shadow shadow-sm"
                />
              </div>
              <div>
                <label className="block text-muted-foreground text-[11px] font-bold uppercase tracking-widest mb-2">Retail (PKR)</label>
                <input
                  type="number"
                  value={form.retailPrice}
                  onChange={(e) => setForm((p) => ({ ...p, retailPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm font-bold focus:outline-none focus:border-brass transition-shadow shadow-sm"
                />
              </div>
            </div>
          </div>

          {product.createdAt && (
            <div className="text-xs text-muted-foreground flex justify-between font-medium pt-2">
              <span>Created</span>
              <span>{new Date(product.createdAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8 pt-6 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-coal text-bone hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors text-sm font-bold shadow-sm"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash className="size-4" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Product Orders Modal ────────────────────────────────────────────────────
function ProductOrdersModal({ product, onClose }: { product: any; onClose: () => void }) {
  const productId = product._id ?? product.id;
  const { data, isLoading } = useQuery({
    queryKey: ["admin-product-orders", productId],
    queryFn: () => adminGetProductOrders(productId),
  });
  const orders = data?.orders ?? [];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card shadow-e3 border border-border rounded-2xl p-6 sm:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className="text-foreground text-xl font-display font-bold flex items-center gap-2">
            <Package className="size-5 text-brass" /> Orders for {product.name}
          </h3>
          <button onClick={onClose} className="border border-border px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shadow-sm">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          {isLoading ? (
            <div className="space-y-4" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="size-10 rounded-lg animate-pulse bg-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/3 rounded animate-pulse bg-secondary" />
                    <div className="h-3 w-2/3 rounded animate-pulse bg-secondary" />
                  </div>
                  <div className="h-6 w-16 rounded-full animate-pulse bg-secondary shrink-0" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
              <Inbox className="size-12 mb-4 text-border" strokeWidth={1} />
              <p className="font-semibold text-lg text-foreground">No orders found</p>
              <p className="text-sm mt-1">This product hasn't been ordered yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any, i: number) => {
                const items = order.items ?? order.products ?? [];
                const stageColor: Record<string, string> = {
                  "Pre Order": "bg-blue-500/10 text-blue-600 border-blue-500/20",
                  "Main Order": "bg-purple-500/10 text-purple-600 border-purple-500/20",
                  "Delivered": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                };
                const stageCls = stageColor[order._stage] ?? "bg-secondary text-muted-foreground border-border";
                return (
                  <div key={order._id ?? i} className="border border-border rounded-xl p-5 bg-background shadow-sm hover:shadow-e1 transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-medium text-muted-foreground">
                        {new Date(order.createdAt ?? order.exportedAt).toLocaleString("en-PK")}
                      </span>
                      {order._stage && <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-0.5 rounded border ${stageCls}`}>{order._stage}</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <p className="eyebrow text-muted-foreground mb-1">Customer</p>
                        <p className="font-semibold text-foreground line-clamp-1">{order.name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="eyebrow text-muted-foreground mb-1">Phone</p>
                        <p className="font-mono text-xs mt-0.5">{order.phoneNumber ?? "—"}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="eyebrow text-muted-foreground mb-1">Amount</p>
                        <p className="text-brass font-bold">PKR {Number(order.totalAmount ?? order.sellPrice ?? 0).toLocaleString("en-PK")}</p>
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div className="border-t border-border pt-4 mt-4 bg-secondary/20 rounded-lg p-3">
                        <p className="eyebrow text-muted-foreground mb-2">Order Items</p>
                        <div className="space-y-1.5">
                          {items.map((item: any, j: number) => (
                            <div key={j} className="flex justify-between text-sm font-medium">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                <Box className="size-3.5" />
                                {item.name ?? item.product ?? "—"}
                              </span>
                              <span className="text-foreground font-bold">x{item.qty ?? item.quantity ?? 0}</span>
                            </div>
                          ))}
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
    </div>
  );
}

// ─── Pagination bar ──────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

function Pagination({
  page, totalPages, total, onPageChange, isLoading,
}: {
  page: number; totalPages: number; total: number;
  onPageChange: (p: number) => void; isLoading?: boolean;
}) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-border bg-secondary/20">
      <p className="text-xs text-muted-foreground font-medium hidden sm:block">
        Page {page} of {totalPages} · {total.toLocaleString()} products
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="size-3" /> Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={isLoading}
            className={`w-8 h-8 text-xs font-bold rounded-lg transition ${p === page ? "bg-coal text-bone" : "hover:bg-secondary text-muted-foreground border border-border"}`}
          >
            {p}
          </button>
        ))}
        <button
          disabled={page === totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
function AdminProducts() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [globalPct, setGlobalPct] = useState("");
  const [catPct, setCatPct] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [activeSection, setActiveSection] = useState<"csv" | "pricing" | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [ordersProduct, setOrdersProduct] = useState<any | null>(null);
  const [csvDownloading, setCsvDownloading] = useState(false);
  // ── Pagination + search state ──────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input → reset to page 1 on new query
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["admin", "products", page, debouncedSearch],
    queryFn: () => adminListProductsPaginated({ page, limit: PAGE_SIZE, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const products = productsData?.products ?? [];
  const totalProducts = productsData?.total ?? 0;
  const totalPages = productsData?.totalPages ?? 1;

  // CSV queue count — to enable/disable the download button
  const { data: csvQueueCount = 0 } = useQuery({
    queryKey: ["admin", "products-csv-queue"],
    queryFn: adminGetCSVQueueCount,
    refetchInterval: 60_000,
  });

  const { data: catPricingData } = useQuery({
    queryKey: ["admin", "category-pricing"],
    queryFn: adminGetCategoryPricing,
  });

  const { data: featuredCount = 0 } = useQuery({
    queryKey: ["admin", "featured-count"],
    queryFn: adminGetFeaturedCount,
  });

  // Seed the global % input from the saved value once data arrives
  useEffect(() => {
    const saved = catPricingData?.globalPricing;
    if (saved != null && globalPct === "") {
      setGlobalPct(String(saved));
    }
  }, [catPricingData?.globalPricing]);

  const categories: string[] = (catPricingData?.categories ?? []).map((c: any) => c.name ?? c);

  const invalidateProducts = () => {
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["admin", "featured-count"] });
  };

  const visibilityMut = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      adminUpdateProduct(id, { hidden }),
    onSuccess: () => { toast.success("Visibility updated."); invalidateProducts(); },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const clearMut = useMutation({
    mutationFn: adminClearProducts,
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "All products cleared.");
      invalidateProducts();
    },
    onError: (e: any) => toast.error(e?.message ?? "Clear failed."),
  });

  const globalPricingMut = useMutation({
    mutationFn: (pct: number) => adminUpdatePricingAll(pct),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Global pricing updated.");
      invalidateProducts();
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const catPricingMut = useMutation({
    mutationFn: ({ category, percentage }: { category: string; percentage: number }) =>
      adminUpdatePricingByCategory(category, percentage),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Category pricing updated.");
      invalidateProducts();
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const featuredMut = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      adminToggleFeaturedOnLanding(id, featured),
    onSuccess: () => {
      toast.success("Landing page feature updated.");
      invalidateProducts();
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const [dynFetchingId, setDynFetchingId] = useState<string | null>(null);

  const dynDataMut = useMutation({
    mutationFn: (id: string) => adminFetchProductDynamicData(id),
    onMutate: (id) => setDynFetchingId(id),
    onSettled: () => setDynFetchingId(null),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Dynamic data fetched.");
      invalidateProducts();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to fetch dynamic data."),
  });

  const deleteProductMut = useMutation({
    mutationFn: adminDeleteProduct,
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Product deleted permanently.");
      invalidateProducts();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete product."),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("csv", file);
    setUploading(true);
    try {
      const res = await adminUploadProductCSV(fd);
      toast.success(res?.message ?? "CSV uploaded successfully.");
      invalidateProducts();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleGlobalPricing = () => {
    const pct = parseFloat(globalPct);
    if (isNaN(pct) || pct < 0) { toast.error("Enter a valid percentage (e.g. 20 for +20%)."); return; }
    if (!window.confirm(`Apply +${pct}% markup to ALL products?`)) return;
    globalPricingMut.mutate(pct);
  };

  const handleCatPricing = () => {
    if (!selectedCat) { toast.error("Select a category."); return; }
    const pct = parseFloat(catPct);
    if (isNaN(pct) || pct < 0) { toast.error("Enter a valid percentage."); return; }
    if (!window.confirm(`Apply +${pct}% markup to all "${selectedCat}" products?`)) return;
    catPricingMut.mutate({ category: selectedCat, percentage: pct });
  };

  const handleDownloadCSV = async () => {
    setCsvDownloading(true);
    try {
      await adminDownloadCSV("");
      toast.success("CSV downloaded.");
    } catch (err: any) {
      toast.error(err?.message ?? "CSV download failed.");
    } finally {
      setCsvDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-px bg-brass"></span> Catalogue
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            Products<span className="text-brass">.</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 font-medium">
            {isLoading ? "Loading…" : `${totalProducts.toLocaleString()} products total`}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-stretch w-full sm:w-auto">
          <button
            onClick={handleDownloadCSV}
            disabled={csvDownloading || csvQueueCount === 0}
            title={csvQueueCount === 0 ? "No orders queued for export" : `${csvQueueCount} order(s) ready`}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 text-sm font-bold bg-card shadow-e1 hover:shadow-e2 border border-border rounded-xl text-foreground hover:bg-secondary disabled:opacity-50 transition-all"
          >
            {csvDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4 text-brass" />}
            {csvDownloading ? "Downloading…" : "Download Order CSV"}
            {csvQueueCount > 0 && !csvDownloading && (
              <span className="ml-0.5 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {csvQueueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection((s) => (s === "csv" ? null : "csv"))}
            className={`flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 text-sm font-bold border rounded-xl transition-all shadow-sm ${activeSection === "csv" ? "bg-coal text-bone border-coal" : "bg-card border-border text-foreground hover:bg-secondary"}`}
          >
            <Upload className="size-4" /> Upload CSV
          </button>
          <button
            onClick={() => { if (window.confirm("Clear ALL products? This cannot be undone.")) clearMut.mutate(); }}
            disabled={clearMut.isPending}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 text-sm font-bold border border-red-500/30 bg-red-500/5 text-red-600 rounded-xl hover:bg-red-500/10 disabled:opacity-50 transition-colors shadow-sm"
          >
            {clearMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash className="size-4" />}
            Clear All
          </button>
        </div>
      </motion.div>

      {/* ── Global Profit Margin card ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-brass/30 bg-card shadow-e1 rounded-2xl p-6"
      >
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brass/10 flex items-center justify-center shrink-0">
              <Percent className="size-5 text-brass" />
            </div>
            <div>
              <p className="eyebrow text-muted-foreground text-[10px] mb-0.5">Global Profit Margin</p>
              <p className="font-display font-bold text-2xl tracking-tight">
                {catPricingData?.globalPricing != null
                  ? <>{catPricingData.globalPricing}<span className="text-brass">%</span></>
                  : <span className="text-muted-foreground text-lg">Not set</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Applied to all new imports · retail = wholesale × (1 + %/100)
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <input
              type="number"
              placeholder="e.g. 20"
              value={globalPct}
              onChange={(e) => setGlobalPct(e.target.value)}
              className="w-32 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm"
            />
            <span className="text-sm font-semibold text-muted-foreground">%</span>
            <button
              onClick={handleGlobalPricing}
              disabled={globalPricingMut.isPending}
              className="px-5 py-2.5 text-sm font-bold bg-brass text-white rounded-xl hover:bg-brass/90 disabled:opacity-50 transition-colors shadow-e1 flex items-center gap-2"
            >
              {globalPricingMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
              {globalPricingMut.isPending ? "Applying…" : "Apply to All"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Product Hunting card ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-brass/20 bg-card shadow-e1 rounded-2xl p-6"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brass/10 flex items-center justify-center shrink-0">
              <Target className="size-5 text-brass" />
            </div>
            <div>
              <p className="eyebrow text-muted-foreground text-[10px] mb-0.5">Product Hunting</p>
              <p className="font-display font-bold text-2xl tracking-tight">
                {featuredCount}
                <span className="text-brass"> featured</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Products on the landing page · Toggle the <Target className="inline size-3 text-brass" /> icon below
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Manual Position Management card ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-brass/20 bg-card shadow-e1 rounded-2xl p-6"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brass/10 flex items-center justify-center shrink-0">
              <ArrowUpDown className="size-5 text-brass" />
            </div>
            <div>
              <p className="eyebrow text-muted-foreground text-[10px] mb-0.5">Manual Position Management</p>
              <p className="font-display font-bold text-2xl tracking-tight">
                Product Ordering
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Set custom positions for products · Positions persist until HHC sync
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm("Clear all manual positions? This will reset all products to default ordering.")) {
                adminClearAllManualPositions()
                  .then(() => {
                    toast.success("All manual positions cleared.");
                    invalidateProducts();
                  })
                  .catch((e: any) => toast.error(e?.message ?? "Failed to clear positions."));
              }
            }}
            className="px-4 py-2 text-sm font-bold border border-border bg-secondary/50 rounded-xl hover:bg-secondary transition-colors"
          >
            Reset All
          </button>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* CSV Upload panel */}
        {activeSection === "csv" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-border rounded-2xl p-8 bg-card shadow-e1 mb-8">
              <h3 className="font-display font-bold text-lg text-foreground tracking-tight mb-4">Upload Product CSV</h3>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className={`flex flex-col items-center gap-4 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:border-brass hover:bg-brass/5 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <Loader2 className="size-10 text-brass animate-spin" /> : <Upload className="size-10 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">{uploading ? "Uploading file…" : "Click to select a .csv file"}</span>
                <span className="text-xs text-muted-foreground">Make sure columns match the required schema</span>
              </label>
            </div>
          </motion.div>
        )}

        {/* Bulk Pricing panel */}
        {activeSection === "pricing" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-border rounded-2xl p-8 bg-card shadow-e1 mb-8 space-y-8">
              <h3 className="font-display font-bold text-lg text-foreground tracking-tight">Bulk Pricing Rules</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="eyebrow text-muted-foreground">Global markup</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="number"
                      placeholder="Percentage (e.g. 20)"
                      value={globalPct}
                      onChange={(e) => setGlobalPct(e.target.value)}
                      className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm"
                    />
                    <button onClick={handleGlobalPricing} disabled={globalPricingMut.isPending}
                      className="px-6 py-3 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1 flex items-center gap-2">
                      {globalPricingMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Apply to All"}
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="eyebrow text-muted-foreground">Per-category markup</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
                      className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm">
                      <option value="">Select category</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" placeholder="%" value={catPct} onChange={(e) => setCatPct(e.target.value)}
                      className="w-24 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm font-bold text-foreground text-center focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm" />
                    <button onClick={handleCatPricing} disabled={catPricingMut.isPending}
                      className="px-6 py-3 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1 flex items-center gap-2">
                      {catPricingMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, SKU, category…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm"
          />
        </div>
        {debouncedSearch && (
          <button
            onClick={() => { setSearchInput(""); setDebouncedSearch(""); setPage(1); }}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-secondary transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Product table */}
      {isLoading && products.length === 0 ? (
        <PanelTableSkeleton rows={10} cols={3} />
      ) : products.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card border border-border rounded-2xl shadow-e1 flex flex-col items-center">
          <Package className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">
            {debouncedSearch ? `No results for "${debouncedSearch}"` : "No products found"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {debouncedSearch ? "Try a different search term." : "Upload a CSV to populate your catalogue."}
          </p>
          {!debouncedSearch && (
            <button
              onClick={() => setActiveSection("csv")}
              className="px-6 py-3 font-bold bg-coal text-bone rounded-xl shadow-e1 hover:bg-coal/90 transition-colors"
            >
              Upload CSV
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-card border border-border shadow-e1 rounded-2xl overflow-hidden transition-opacity ${isLoading ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Cards (below xl): stacked rows — no horizontal scroll */}
          <div className="xl:hidden divide-y divide-border">
            {products.map((p: any) => {
              const pid = p._id ?? p.id;
              const isHidden = p.hidden ?? false;
              const sales = p.salesCount ?? 0;
              const inStock = p.inStock ?? (p.stock ?? 0) > 0;
              const retail = Number(p.retailPrice ?? p.price ?? 0);
              const wholesale = Number(p.wholesalePrice ?? 0);
              const margin = wholesale > 0 ? Math.round(((retail - wholesale) / wholesale) * 100) : null;
              return (
                <div key={pid} className={`px-4 py-4 space-y-3 hover:bg-secondary/40 active:bg-secondary/60 transition-colors ${isHidden ? "opacity-50 grayscale" : ""}`}>
                  {/* Thumbnail + name */}
                  <div className="flex items-start gap-3">
                    {(p.imageUrl ?? p.image_url) ? (
                      <img src={(p.imageUrl ?? p.image_url).split(",")[0].split("?")[0].trim()} alt={p.name} className="size-12 object-cover bg-secondary border border-border shrink-0 rounded-lg shadow-sm" />
                    ) : (
                      <div className="size-12 bg-secondary border border-border shrink-0 rounded-lg flex items-center justify-center shadow-sm">
                        <Package className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground line-clamp-2">{p.name}</p>
                      {p.sku && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>}
                      {p.dynamicDataFetched && (
                        <span
                          className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                          title={p.dynamicDataFetchedAt ? `Fetched ${new Date(p.dynamicDataFetchedAt).toLocaleString("en-PK")}` : "Dynamic data fetched"}
                        >
                          <CheckCircle className="size-3" /> Dynamic data fetched
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category · pricing · stock · status · sold */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className="font-medium text-muted-foreground">{p.category_name ?? p.category ?? "—"}</span>
                    {p.manualPosition !== null && p.manualPosition !== undefined && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brass bg-brass/10 border border-brass/20 px-2 py-0.5 rounded-full">
                        <ArrowUpDown className="size-3" /> Pos: {p.manualPosition}
                      </span>
                    )}
                    <span className="font-bold text-foreground">Rs {retail.toLocaleString()}</span>
                    {wholesale > 0 ? (
                      <span className="text-muted-foreground font-medium">
                        Cost: Rs {wholesale.toLocaleString()}
                        {margin !== null && (
                          <span className={`ml-1 font-bold ${margin > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            ({margin > 0 ? "+" : ""}{margin}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No cost data</span>
                    )}
                    <span className={`font-bold inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-md text-xs ${(p.stock ?? 0) === 0 ? "bg-red-500/10 text-red-600" : (p.stock ?? 0) <= 10 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                      {p.stock ?? 0}
                    </span>
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border ${inStock ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}>
                      {inStock ? "In stock" : "Out"}
                    </span>
                    <span className="text-muted-foreground">
                      Sold: <span className="font-bold text-brass">{sales > 0 ? sales : "—"}</span>
                    </span>
                  </div>

                  {/* Full actions set — wraps, never overflows */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => setEditingProduct(p)}
                      title="Edit product"
                      className="size-9 flex items-center justify-center border border-border bg-card hover:bg-secondary hover:border-coal/30 text-muted-foreground hover:text-foreground rounded-lg transition-all shadow-sm"
                    >
                      <Edit2 className="size-4" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => setOrdersProduct(p)}
                      title="View orders"
                      className="size-9 flex items-center justify-center border border-border bg-card hover:bg-secondary hover:border-brass text-muted-foreground hover:text-brass rounded-lg transition-all shadow-sm"
                    >
                      <Package className="size-4" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => dynDataMut.mutate(pid)}
                      disabled={dynDataMut.isPending && dynFetchingId === pid}
                      title={p.dynamicDataFetched ? "Refresh dynamic data from HHC" : "Get dynamic data from HHC"}
                      className={`flex-1 min-w-0 justify-center flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold border rounded-lg transition-all shadow-sm whitespace-nowrap ${p.dynamicDataFetched ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10" : "border-border bg-card hover:bg-secondary hover:border-brass/50 text-muted-foreground hover:text-brass"} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {dynDataMut.isPending && dynFetchingId === pid ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" strokeWidth={2} />}
                      {dynDataMut.isPending && dynFetchingId === pid ? "Fetching…" : "Get Product Dynamic Data"}
                    </button>
                    <button
                      onClick={() => visibilityMut.mutate({ id: pid, hidden: !isHidden })}
                      title={isHidden ? "Show on store" : "Hide from store"}
                      className={`size-9 flex items-center justify-center border rounded-lg transition-all shadow-sm ${isHidden ? "border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10" : "border-border bg-card hover:bg-secondary hover:border-emerald-500/50 text-muted-foreground hover:text-emerald-600"}`}
                    >
                      {isHidden ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
                    </button>
                    <button
                      onClick={() => featuredMut.mutate({ id: pid, featured: !(p.featuredOnLanding ?? false) })}
                      disabled={featuredMut.isPending}
                      title={p.featuredOnLanding ? "Remove from landing page" : "Feature on landing page"}
                      className={`size-9 flex items-center justify-center border rounded-lg transition-all shadow-sm disabled:opacity-50 ${(p.featuredOnLanding ?? false) ? "border-brass bg-brass/10 text-brass hover:bg-brass/20" : "border-border bg-card hover:bg-secondary hover:border-brass/50 text-muted-foreground hover:text-brass"}`}
                    >
                      {featuredMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" strokeWidth={2} />}
                    </button>
                    <Link
                      to="/products/$productId"
                      params={{ productId: p.slug || pid }}
                      target="_blank"
                      className="size-9 flex items-center justify-center border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-all shadow-sm"
                    >
                      <ExternalLink className="size-4" strokeWidth={2} />
                    </Link>
                    <button
                      onClick={() => { if (window.confirm(`Delete "${p.name}" permanently? This cannot be undone.`)) deleteProductMut.mutate(pid); }}
                      disabled={deleteProductMut.isPending}
                      title="Delete product permanently"
                      className="size-9 flex items-center justify-center border border-red-200 dark:border-red-800 bg-card hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 rounded-lg transition-all shadow-sm disabled:opacity-50"
                    >
                      {deleteProductMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash className="size-4" strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table (xl+): full table — fits natively, no scroll */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold">Product</th>
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold">Category</th>
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold text-right">Retail / Cost</th>
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold text-right">Stock</th>
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold text-right">Sold</th>
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold text-center">Status</th>
                  <th className="px-2.5 py-4 eyebrow text-muted-foreground font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p: any) => {
                  const pid = p._id ?? p.id;
                  const isHidden = p.hidden ?? false;
                  const sales = p.salesCount ?? 0;
                  const inStock = p.inStock ?? (p.stock ?? 0) > 0;
                  return (
                    <tr key={pid} className={`hover:bg-secondary/40 transition-colors ${isHidden ? "opacity-50 grayscale" : ""}`}>
                      <td className="px-2.5 py-4">
                        <div className="flex items-center gap-3">
                          {(p.imageUrl ?? p.image_url) ? (
                            <img src={(p.imageUrl ?? p.image_url).split(",")[0].split("?")[0].trim()} alt={p.name} className="size-8 object-cover bg-secondary border border-border shrink-0 rounded-lg shadow-sm" />
                          ) : (
                            <div className="size-8 bg-secondary border border-border shrink-0 rounded-lg flex items-center justify-center shadow-sm">
                              <Package className="size-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground line-clamp-1 max-w-[140px]" title={p.name}>{p.name}</p>
                            {p.sku && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>}
                            <div className="flex items-center gap-1.5 mt-1">
                              {p.manualPosition !== null && p.manualPosition !== undefined && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-brass bg-brass/10 border border-brass/20 px-2 py-0.5 rounded-full"
                                  title="Manual position set"
                                >
                                  <ArrowUpDown className="size-3" /> {p.manualPosition}
                                </span>
                              )}
                              {p.dynamicDataFetched && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                                  title={p.dynamicDataFetchedAt ? `Fetched ${new Date(p.dynamicDataFetchedAt).toLocaleString("en-PK")}` : "Dynamic data fetched"}
                                >
                                  <CheckCircle className="size-3" /> Dynamic data fetched
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2.5 py-4 font-medium text-muted-foreground max-w-[150px]"><span className="block truncate">{p.category_name ?? p.category ?? "—"}</span></td>
                      <td className="px-2.5 py-4 text-right whitespace-nowrap">
                        {(() => {
                          const retail = Number(p.retailPrice ?? p.price ?? 0);
                          const wholesale = Number(p.wholesalePrice ?? 0);
                          const margin = wholesale > 0 ? Math.round(((retail - wholesale) / wholesale) * 100) : null;
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-bold text-foreground">Rs {retail.toLocaleString()}</span>
                              {wholesale > 0 ? (
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  Cost: Rs {wholesale.toLocaleString()}
                                  {margin !== null && (
                                    <span className={`ml-1.5 font-bold ${margin > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                      ({margin > 0 ? "+" : ""}{margin}%)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">No cost data</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2.5 py-4 text-right">
                        <span className={`font-bold inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-md text-xs ${(p.stock ?? 0) === 0 ? "bg-red-500/10 text-red-600" : (p.stock ?? 0) <= 10 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                          {p.stock ?? 0}
                        </span>
                      </td>
                      <td className="px-2.5 py-4 text-right">
                        {sales > 0 ? (
                          <span className="font-bold text-brass">{sales}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-4 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border ${inStock ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}>
                          {inStock ? "In stock" : "Out"}
                        </span>
                      </td>
                      <td className="px-2.5 py-4">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setEditingProduct(p)}
                            title="Edit product"
                            className="size-8 flex items-center justify-center border border-border bg-card hover:bg-secondary hover:border-coal/30 text-muted-foreground hover:text-foreground rounded-lg transition-all shadow-sm"
                          >
                            <Edit2 className="size-3.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => setOrdersProduct(p)}
                            title="View orders"
                            className="size-8 flex items-center justify-center border border-border bg-card hover:bg-secondary hover:border-brass text-muted-foreground hover:text-brass rounded-lg transition-all shadow-sm"
                          >
                            <Package className="size-3.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => dynDataMut.mutate(pid)}
                            disabled={dynDataMut.isPending && dynFetchingId === pid}
                            title={p.dynamicDataFetched ? "Refresh dynamic data from HHC" : "Get dynamic data from HHC"}
                            className={`size-8 2xl:size-auto 2xl:px-3 2xl:py-1.5 2xl:gap-1.5 flex items-center justify-center text-[11px] font-bold border rounded-lg transition-all shadow-sm whitespace-nowrap ${p.dynamicDataFetched ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10" : "border-border bg-card hover:bg-secondary hover:border-brass/50 text-muted-foreground hover:text-brass"} disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {dynDataMut.isPending && dynFetchingId === pid ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" strokeWidth={2} />}
                            <span className="hidden 2xl:inline">
                              {dynDataMut.isPending && dynFetchingId === pid ? "Fetching…" : "Get Product Dynamic Data"}
                            </span>
                          </button>
                          <button
                            onClick={() => visibilityMut.mutate({ id: pid, hidden: !isHidden })}
                            title={isHidden ? "Show on store" : "Hide from store"}
                            className={`size-8 flex items-center justify-center border rounded-lg transition-all shadow-sm ${isHidden ? "border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10" : "border-border bg-card hover:bg-secondary hover:border-emerald-500/50 text-muted-foreground hover:text-emerald-600"}`}
                          >
                            {isHidden ? <EyeOff className="size-3.5" strokeWidth={2} /> : <Eye className="size-3.5" strokeWidth={2} />}
                          </button>
                          <button
                            onClick={() => featuredMut.mutate({ id: pid, featured: !(p.featuredOnLanding ?? false) })}
                            disabled={featuredMut.isPending}
                            title={p.featuredOnLanding ? "Remove from landing page" : "Feature on landing page"}
                            className={`size-8 flex items-center justify-center border rounded-lg transition-all shadow-sm disabled:opacity-50 ${(p.featuredOnLanding ?? false) ? "border-brass bg-brass/10 text-brass hover:bg-brass/20" : "border-border bg-card hover:bg-secondary hover:border-brass/50 text-muted-foreground hover:text-brass"}`}
                          >
                            {featuredMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Target className="size-3.5" strokeWidth={2} />}
                          </button>
                          <Link
                            to="/products/$productId"
                            params={{ productId: p.slug || pid }}
                            target="_blank"
                            className="size-8 flex items-center justify-center border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-all shadow-sm"
                          >
                            <ExternalLink className="size-3.5" strokeWidth={2} />
                          </Link>
                          <button
                            onClick={() => { if (window.confirm(`Delete "${p.name}" permanently? This cannot be undone.`)) deleteProductMut.mutate(pid); }}
                            disabled={deleteProductMut.isPending}
                            title="Delete product permanently"
                            className="size-8 flex items-center justify-center border border-red-200 dark:border-red-800 bg-card hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 rounded-lg transition-all shadow-sm disabled:opacity-50"
                          >
                            {deleteProductMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash className="size-3.5" strokeWidth={2} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalProducts}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </motion.div>
      )}

      <AnimatePresence>
        {editingProduct && (
          <ProductEditModal
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSaved={() => { invalidateProducts(); qc.invalidateQueries({ queryKey: ["admin-leaderboard"] }); }}
          />
        )}

        {ordersProduct && (
          <ProductOrdersModal product={ordersProduct} onClose={() => setOrdersProduct(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
