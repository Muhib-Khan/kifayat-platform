import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit3, Image as ImageIcon, Package, Plus, RefreshCw, Store, Trash2, X, Video,
  Play, Tag, ShoppingCart, TrendingUp, BarChart3, Clock3, CheckCircle,
  AlertTriangle, MoreVertical, Search, ExternalLink,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  sellerCreateProduct,
  sellerDeleteProduct,
  sellerListProducts,
  sellerUpdateProduct,
  sellerUploadProductFiles,
  getSellerAnalytics,
} from "@/lib/seller.functions";
import { SellerAnalytics } from "@/components/seller/SellerAnalytics";
import { useAuth } from "@/lib/auth-store";
import type { UIProduct } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/seller/dashboard")({
  beforeLoad: async () => {
    const data = await api.get<{ user: { role: string } | null }>("/auth/me");
    if (data.user?.role !== "seller") throw redirect({ to: "/" });
  },
  component: SellerDashboard,
});

type FormState = {
  name: string;
  description: string;
  retailPrice: string;
  stock: string;
  category: string;
  weight: string;
  sku: string;
  imageUrl: string;
  videoUrl: string;
};

const emptyForm: FormState = {
  name: "", description: "", retailPrice: "", stock: "0", category: "Uncategorized",
  weight: "0", sku: "", imageUrl: "", videoUrl: "",
};

function SellerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["seller", "products"],
    queryFn: sellerListProducts,
  });

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ["seller", "analytics"],
    queryFn: getSellerAnalytics,
    staleTime: 60_000,
  });

  // ── Derived ─────────────────────────────────────────────────────────────────
  const analytics = analyticsData?.analytics;
  const analyticsProducts = analytics?.products ?? [];

  // Build a quick lookup of analytics data (unitsSold, revenue, lastSoldAt) by product id
  const analyticsByProduct = new Map(
    analyticsProducts.map((p: any) => [p.id, p]),
  );

  const filteredProducts = searchInput
    ? products.filter((p: UIProduct) =>
        (p.name || "").toLowerCase().includes(searchInput.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(searchInput.toLowerCase()) ||
        (p.category_name || "").toLowerCase().includes(searchInput.toLowerCase()),
      )
    : products;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        retailPrice: Number(form.retailPrice),
        stock: Number(form.stock),
        category: form.category.trim() || "Uncategorized",
        weight: Number(form.weight) || 0,
        sku: form.sku.trim(),
        imageUrl: form.imageUrl.trim(),
        videoUrl: form.videoUrl.trim(),
      };
      if (editingId) return sellerUpdateProduct(editingId, payload);
      return sellerCreateProduct(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Product updated." : "Product added to your store.");
      resetForm();
      qc.invalidateQueries({ queryKey: ["seller", "products"] });
      qc.invalidateQueries({ queryKey: ["seller-store", "faizs-store"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => toast.error(error?.message || "Could not save product."),
  });

  const deleteMutation = useMutation({
    mutationFn: sellerDeleteProduct,
    onSuccess: () => {
      toast.success("Product deleted.");
      qc.invalidateQueries({ queryKey: ["seller", "products"] });
      qc.invalidateQueries({ queryKey: ["seller-store", "faizs-store"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => toast.error(error?.message || "Could not delete product."),
  });

  // ── Form helpers ────────────────────────────────────────────────────────────
  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  }

  function editProduct(product: any) {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      retailPrice: String(product.price || product.retailPrice || 0),
      stock: String(product.stock || 0),
      category: product.category_name || product.category || "Uncategorized",
      weight: String(product.weight || 0),
      sku: product.sku || "",
      imageUrl: product.image_url || "",
      videoUrl: product.videoUrl || "",
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField(key: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  const parseImageUrls = (val: string): string[] =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const removeImageUrl = (urlToRemove: string) => {
    const urls = parseImageUrls(form.imageUrl).filter((u) => u !== urlToRemove);
    setForm((p) => ({ ...p, imageUrl: urls.join(", ") }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("images", f);
      const res = await sellerUploadProductFiles(fd);
      const newUrls = res.images ?? [];
      const existing = parseImageUrls(form.imageUrl);
      const combined = [...existing, ...newUrls].filter(
        (u, i, arr) => arr.indexOf(u) === i,
      );
      setForm((p) => ({ ...p, imageUrl: combined.join(", ") }));
      if (newUrls.length === 0) toast.warning("No valid images were uploaded.");
      else toast.success(`Uploaded ${newUrls.length} image(s).`);
    } catch (err: any) {
      toast.error(err?.message ?? "Image upload failed.");
    } finally {
      setUploadingImages(false);
      if (imageFileRef.current) imageFileRef.current.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await sellerUploadProductFiles(fd);
      const videoUrl = res.video ?? null;
      if (videoUrl) {
        setForm((p) => ({ ...p, videoUrl: videoUrl }));
        toast.success("Video uploaded successfully.");
      } else {
        toast.warning("No valid video was uploaded.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Video upload failed.");
    } finally {
      setUploadingVideo(false);
      if (videoFileRef.current) videoFileRef.current.value = "";
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const statusBadge = (product: any) => {
    if (product.deleted) return { label: "Deleted", cls: "text-red-600 bg-red-50 border-red-200" };
    if (product.hidden) return { label: "Hidden", cls: "text-amber-600 bg-amber-50 border-amber-200" };
    const stock = Number(product.stock || 0);
    if (stock === 0) return { label: "Out of stock", cls: "text-red-600 bg-red-50 border-red-200" };
    if (stock <= 5) return { label: "Low stock", cls: "text-amber-600 bg-amber-50 border-amber-200" };
    return { label: "Live", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "delivered": return <CheckCircle className="size-4 text-emerald-600" />;
      case "cancelled": return <AlertTriangle className="size-4 text-red-600" />;
      default: return <Clock3 className="size-4 text-amber-600" />;
    }
  };

  return (
    <div className="min-h-[70vh] bg-bone">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="border-b border-coal/10 bg-coal text-bone">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="size-16 sm:size-20 rounded-2xl bg-brass text-coal grid place-items-center font-display text-3xl sm:text-4xl shrink-0">
                {(user?.storeName || user?.name || "S").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="eyebrow text-brass text-[10px] mb-2">Seller workspace</p>
                <h1 className="font-display italic text-3xl sm:text-4xl">{user?.storeName || "Faiza's Store"}</h1>
                <p className="mt-2 text-sm text-bone/65">
                  {user?.name || ""} · {user?.email || ""}
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap items-stretch w-full sm:w-auto">
              <button
                type="button"
                onClick={() => refetchAnalytics()}
                disabled={analyticsLoading}
                className="inline-flex items-center justify-center gap-2 border border-bone/20 px-4 py-2.5 text-sm font-semibold text-bone hover:bg-bone/10 disabled:opacity-50 transition-colors"
                title="Refresh analytics"
              >
                <RefreshCw className={`size-4 ${analyticsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => { setEditingId(null); setForm(emptyForm); setFormOpen(true); }}
                className="inline-flex items-center justify-center gap-2 bg-brass text-coal px-5 py-3 text-sm font-semibold hover:bg-brass/90 transition-colors"
              >
                <Plus className="size-4" /> Add product
              </button>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-bone/70">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-brass" />
              <span>{products.length} {products.length === 1 ? "product" : "products"} in your store</span>
            </div>
            {analytics && (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-brass" />
                  <span>{analytics.kpi.totalRevenue ? `Rs ${Math.round(analytics.kpi.totalRevenue).toLocaleString("en-PK")} lifetime revenue` : "No revenue yet"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-brass" />
                  <span>{analytics.kpi.totalOrders} tracked orders</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Analytics ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        {analyticsLoading ? (
          <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Loading seller analytics">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 bg-paper border border-coal/10 animate-pulse" />
            ))}
          </div>
        ) : analyticsError ? (
          <div className="mb-10 border border-red-500/20 bg-red-50/60 p-8 text-center">
            <p className="font-display italic text-xl text-red-900">Seller intelligence could not load.</p>
            <p className="mt-2 text-sm text-red-900/65">Your products remain available below. Retry to reload the account analysis.</p>
            <button type="button" onClick={() => refetchAnalytics()} className="mt-5 inline-flex items-center gap-2 bg-coal px-4 py-2.5 text-sm font-semibold text-bone hover:bg-coal/90">
              <RefreshCw className="size-4" /> Retry analysis
            </button>
          </div>
        ) : analytics ? (
          <SellerAnalytics analytics={analytics} seller={analyticsData?.seller} />
        ) : null}

        {/* ── Tabbed management section ───────────────────────────────────── */}
        <div className="mt-10 bg-paper border border-coal/10 shadow-sm">
          <nav className="flex border-b border-coal/10">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all ${activeTab === "products" ? "border-brass border-b-2 text-brass" : "text-coal/50 hover:text-coal"} }`}
            >
              <Package className="size-4" /> Products
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all ${activeTab === "orders" ? "border-brass border-b-2 text-brass" : "text-coal/50 hover:text-coal"} }`}
            >
              <ShoppingCart className="size-4" /> Orders
            </button>
          </nav>

          <div className="p-6">
            {activeTab === "products" && (
              <>
                {/* ── Product form ── */}
                {formOpen && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveMutation.mutate();
                    }}
                    className="border border-coal/15 bg-bone/30 p-6 sm:p-7 mb-8"
                  >
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <p className="eyebrow text-brass text-[10px] mb-1">{editingId ? "Edit listing" : "New listing"}</p>
                        <h2 className="font-display italic text-2xl">{editingId ? "Update product" : "Add a product"}</h2>
                      </div>
                      <button type="button" onClick={resetForm} aria-label="Close product form" className="p-2 text-coal/50 hover:text-coal">
                        <X className="size-5" />
                      </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <label className="sm:col-span-2">
                        <span className="block text-[10px] eyebrow text-coal/45 mb-2 font-bold uppercase tracking-wider">Product name</span>
                        <input
                          required
                          value={form.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          className="seller-input"
                          placeholder="e.g. Handcrafted leather wallet"
                        />
                      </label>

                      <label>
                        <span className="field-label">SKU</span>
                        <input
                          value={form.sku}
                          onChange={(e) => updateField("sku", e.target.value)}
                          className="seller-input"
                          placeholder="ABC-123"
                        />
                      </label>

                      <label>
                        <span className="field-label">Category</span>
                        <input
                          value={form.category}
                          onChange={(e) => updateField("category", e.target.value)}
                          className="seller-input"
                          placeholder="Fashion"
                        />
                      </label>

                      <label>
                        <span className="field-label">Selling price (PKR)</span>
                        <input
                          required
                          min="0"
                          type="number"
                          value={form.retailPrice}
                          onChange={(e) => updateField("retailPrice", e.target.value)}
                          className="seller-input"
                        />
                      </label>

                      <label>
                        <span className="field-label">Stock</span>
                        <input
                          min="0"
                          type="number"
                          value={form.stock}
                          onChange={(e) => updateField("stock", e.target.value)}
                          className="seller-input"
                        />
                      </label>

                      <label>
                        <span className="field-label">Weight (kg)</span>
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={form.weight}
                          onChange={(e) => updateField("weight", e.target.value)}
                          className="seller-input"
                        />
                      </label>

                      <label className="sm:col-span-2">
                        <span className="field-label">Description</span>
                        <textarea
                          value={form.description}
                          onChange={(e) => updateField("description", e.target.value)}
                          className="seller-input min-h-24 resize-y"
                          placeholder="Tell buyers what makes it useful."
                        />
                      </label>

                      {/* ── Image URLs + gallery upload ── */}
                      <label className="sm:col-span-2">
                        <span className="field-label">Image URLs</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={form.imageUrl}
                            onChange={(e) => updateField("imageUrl", e.target.value)}
                            placeholder="Comma-separated image URLs"
                            className="seller-input flex-1"
                          />
                          <input
                            ref={imageFileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => imageFileRef.current?.click()}
                            disabled={uploadingImages}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold border border-coal/15 bg-bone hover:bg-coal/10 rounded disabled:opacity-50 transition-colors"
                          >
                            {uploadingImages ? <RefreshCw className="size-4 animate-spin" /> : <ImageIcon className="size-4 text-brass" />}
                            Upload
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-coal/50">
                          Paste image URLs or upload JPG, PNG, WebP, GIF files from your device.
                        </p>
                        {parseImageUrls(form.imageUrl).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {parseImageUrls(form.imageUrl).map((url, i) => (
                              <div key={i} className="relative group">
                                <img
                                  src={url}
                                  alt={`Image ${i + 1}`}
                                  className="size-16 object-cover bg-coal/5 border border-coal/10 rounded shadow-sm"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3C/svg%3E";
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImageUrl(url)}
                                  className="absolute -top-1 -right-1 size-5 flex items-center justify-center bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                  title="Remove image"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </label>

                      {/* ── Video URL + gallery upload ── */}
                      <label className="sm:col-span-2">
                        <span className="field-label">Video URL</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={form.videoUrl}
                            onChange={(e) => updateField("videoUrl", e.target.value)}
                            placeholder="Enter a video URL or upload from your device"
                            className="seller-input flex-1"
                          />
                          <input
                            ref={videoFileRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={handleVideoUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => videoFileRef.current?.click()}
                            disabled={uploadingVideo}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold border border-coal/15 bg-bone hover:bg-coal/10 rounded disabled:opacity-50 transition-colors"
                          >
                            {uploadingVideo ? <RefreshCw className="size-4 animate-spin" /> : <Video className="size-4 text-brass" />}
                            Upload
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-coal/50">Paste a video URL or upload MP4, MOV, WebM (max 50 MB).</p>
                        {form.videoUrl && (
                          <div className="mt-3">
                            {form.videoUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                              <video
                                src={form.videoUrl}
                                controls
                                className="max-w-full max-h-48 rounded-lg border border-coal/10 shadow-sm"
                              />
                            ) : (
                              <div className="flex items-center gap-3 p-3 bg-coal/5 rounded-lg border border-coal/10">
                                <Play className="size-5 text-brass" />
                                <span className="text-sm text-coal/80 font-medium truncate flex-1">{form.videoUrl}</span>
                                <a
                                  href={form.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-brass hover:text-brass/80"
                                >
                                  <ExternalLink className="size-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-7 pt-6 border-t border-coal/15">
                      <button
                        disabled={saveMutation.isPending}
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 bg-coal text-bone px-5 py-3 text-sm font-semibold hover:bg-coal/90 disabled:opacity-50 transition-colors"
                      >
                        {saveMutation.isPending ? "Saving…" : editingId ? "Save changes" : "Publish product"}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="border border-coal/20 px-5 py-3 text-sm hover:bg-bone transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* ── Product table (desktop) ── */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-coal/40" />
                    <input
                      type="text"
                      placeholder="Search name, SKU, category…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-bone border border-coal/15 rounded focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass/30 transition-colors"
                    />
                  </div>
                  <span className="text-sm text-coal/50">{filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}</span>
                </div>

                {isLoading ? (
                  <div className="space-y-3" aria-label="Loading products">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="h-16 border border-coal/10 bg-bone/40 animate-pulse" />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="border border-dashed border-coal/20 py-20 text-center">
                    <Store className="size-12 mx-auto text-coal/10" strokeWidth={1.2} />
                    <h2 className="mt-4 font-display italic text-2xl text-coal/70">
                      {searchInput ? "No matching products" : "Your shelf is empty"}
                    </h2>
                    <p className="mt-2 text-sm text-coal/50">
                      {searchInput ? "Try a different search term." : "Add your first product to show it in your store."}
                    </p>
                    {!searchInput && (
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setForm(emptyForm); setFormOpen(true); }}
                        className="mt-6 text-sm text-brass underline underline-offset-4"
                      >
                        Add the first product
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-coal/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-coal/10 bg-coal/5 text-left text-[10px] eyebrow text-coal/45">
                          <th className="px-4 py-3">Product</th>
                          <th className="px-3 py-3">SKU</th>
                          <th className="px-3 py-3">Category</th>
                          <th className="px-3 py-3 text-right">Price</th>
                          <th className="px-3 py-3 text-right">Stock</th>
                          <th className="px-3 py-3 text-right">Units sold</th>
                          <th className="px-3 py-3 text-right">Status</th>
                          <th className="px-3 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-coal/7">
                        {filteredProducts.map((product: any) => {
                          const badge = statusBadge(product);
                          const an = analyticsByProduct.get(product.id);
                          return (
                            <tr key={product.id} className="hover:bg-bone/40 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="size-10 object-cover bg-coal/5 border border-coal/10 rounded shadow-sm"
                                    />
                                  ) : (
                                    <div className="size-10 bg-coal/5 border border-coal/10 rounded grid place-items-center">
                                      <Package className="size-5 text-coal/20" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-medium text-coal/85 line-clamp-1 max-w-[140px] sm:max-w-[200px]">{product.name}</p>
                                    {product.sku && (
                                      <p className="text-[10px] text-coal/45 font-mono mt-0.5">{product.sku}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-coal/65">
                                {product.sku ? <span className="font-mono text-xs">{product.sku}</span> : <span className="text-coal/30">—</span>}
                              </td>
                              <td className="px-3 py-3 text-coal/65 max-w-[120px] truncate">
                                {product.category_name || product.category || "—"}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-coal/85">
                                Rs {Number(product.price || 0).toLocaleString("en-PK")}
                              </td>
                              <td className="px-3 py-3 text-right text-coal/70">{product.stock ?? 0}</td>
                              <td className="px-3 py-3 text-right text-coal/70">
                                {an ? an.unitsSold.toLocaleString() : "—"}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold border rounded-full ${badge.cls}`}>
                                  <span className="size-1.5 rounded-full bg-current" />
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => editProduct(product)}
                                    title="Edit product"
                                    className="p-1.5 text-coal/50 hover:text-coal hover:bg-coal/5 rounded transition-colors"
                                  >
                                    <Edit3 className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete "${product.name}" permanently? This cannot be undone.`))
                                        deleteMutation.mutate(product.id);
                                    }}
                                    disabled={deleteMutation.isPending}
                                    title="Delete product"
                                    className="p-1.5 text-coal/50 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Product cards (mobile) ── */}
                <div className="sm:hidden mt-4 space-y-3">
                  {filteredProducts.map((product: any) => {
                    const badge = statusBadge(product);
                    const an = analyticsByProduct.get(product.id);
                    return (
                      <div key={product.id} className="border border-coal/10 bg-paper p-4 rounded-lg shadow-sm">
                        <div className="flex items-start gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="size-14 object-cover bg-coal/5 border border-coal/10 rounded shadow-sm" />
                          ) : (
                            <div className="size-14 bg-coal/5 border border-coal/10 rounded grid place-items-center">
                              <Package className="size-5 text-coal/20" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-coal/85 line-clamp-2">{product.name}</p>
                            {product.sku && <p className="text-[10px] text-coal/45 font-mono mt-0.5">{product.sku}</p>}
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-display italic text-lg text-brass">Rs {Number(product.price || 0).toLocaleString("en-PK")}</span>
                              <span className={`text-[10px] font-semibold px-2 py-1 border rounded-full ${badge.cls}`}>{badge.label}</span>
                            </div>
                            {an && an.unitsSold > 0 && (
                              <p className="text-xs text-coal/50 mt-1">{an.unitsSold} sold · Rs {an.revenue.toLocaleString("en-PK")} revenue</p>
                            )}
                          </div>
                          <button
                            onClick={() => editProduct(product)}
                            title="Edit product"
                            className="ml-2 p-1.5 text-coal/50 hover:text-coal hover:bg-coal/5 rounded transition-colors"
                          >
                            <Edit3 className="size-4" />
                          </button>
                    </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Orders tab ── */}
            {activeTab === "orders" && (
              <div className="space-y-6">
                {analyticsLoading ? (
                  <div className="text-center py-12 text-coal/50">
                    <RefreshCw className="size-8 mx-auto animate-spin text-coal/20 mb-3" />
                    <p>Loading order data…</p>
                  </div>
                ) : !analytics ? (
                  <div className="text-center py-12 text-coal/50">
                    <ShoppingCart className="size-12 mx-auto text-coal/10 mb-4" />
                    <p>Order data requires analytics to be loaded.</p>
                    <button
                      type="button"
                      onClick={() => refetchAnalytics()}
                      className="mt-3 text-sm text-brass underline"
                    >
                      Load analytics
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Order status summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="border border-coal/10 bg-bone/30 p-4 text-center">
                        <CheckCircle className="size-5 mx-auto text-emerald-600 mb-1" />
                        <p className="font-display italic text-2xl text-emerald-800">{analytics.kpi.deliveredOrders}</p>
                        <p className="text-[10px] eyebrow text-coal/50">Delivered</p>
                      </div>
                      <div className="border border-coal/10 bg-bone/30 p-4 text-center">
                        <Clock3 className="size-5 mx-auto text-amber-600 mb-1" />
                        <p className="font-display italic text-2xl text-amber-800">{analytics.kpi.pendingOrders}</p>
                        <p className="text-[10px] eyebrow text-coal/50">Pending</p>
                      </div>
                      <div className="border border-coal/10 bg-bone/30 p-4 text-center">
                        <AlertTriangle className="size-5 mx-auto text-red-600 mb-1" />
                        <p className="font-display italic text-2xl text-red-800">{analytics.kpi.cancelledOrders}</p>
                        <p className="text-[10px] eyebrow text-coal/50">Cancelled</p>
                      </div>
                      <div className="border border-coal/10 bg-bone/30 p-4 text-center">
                        <ShoppingCart className="size-5 mx-auto text-brass mb-1" />
                        <p className="font-display italic text-2xl text-coal">{analytics.kpi.totalOrders}</p>
                        <p className="text-[10px] eyebrow text-coal/50">Total orders</p>
                      </div>
                    </div>

                    {/* Recent orders table */}
                    <div>
                      <h3 className="font-semibold text-sm mb-3">Recent orders</h3>
                      <p className="text-xs text-coal/50 mb-4">Last 20 orders attributed to your products across checkout, pre-order, and history records.</p>
                      {analytics.recentOrders.length ? (
                        <div className="overflow-x-auto border border-coal/10">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-y border-coal/10 bg-coal/5 text-left text-[10px] eyebrow text-coal/45">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-3 py-3">Order ID</th>
                                <th className="px-3 py-3">Source</th>
                                <th className="px-3 py-3">City</th>
                                <th className="px-3 py-3 text-right">Units</th>
                                <th className="px-3 py-3 text-right">Revenue</th>
                                <th className="px-3 py-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-coal/7">
                              {analytics.recentOrders.map((order: any) => (
                                <tr key={`${order.source}-${order.id}`} className="hover:bg-bone/40">
                                  <td className="px-4 py-3.5">
                                    <span className="font-medium">
                                      {new Date(order.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                                    </span>
                                    <span className="ml-1 text-[10px] text-coal/40">
                                      {new Date(order.date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3.5 text-coal/65 font-mono text-xs">
                                    KFY-{String(order.id).slice(-6).toUpperCase()}
                                  </td>
                                  <td className="px-3 py-3.5 text-coal/60 capitalize">{order.source?.replace("_", " ") || "—"}</td>
                                  <td className="px-3 py-3.5 text-coal/60">{order.city || "—"}</td>
                                  <td className="px-3 py-3.5 text-right text-coal/70 tabular-nums">{order.units}</td>
                                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                                    Rs {Number(order.revenue || 0).toLocaleString("en-PK")}
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    {statusIcon(order.status)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="border border-dashed border-coal/20 py-16 text-center">
                          <ShoppingCart className="size-12 mx-auto text-coal/10 mb-4" />
                          <p className="font-display italic text-xl text-coal/70">No orders yet</p>
                          <p className="mt-2 text-sm text-coal/50">Orders attributed to your products will appear here.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </section>

    <style>{`
      .field-label { display: block; margin-bottom: .5rem; font: 600 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: rgb(45 45 45 / .58); }
      .seller-input { width: 100%; border: 1px solid rgb(45 45 45 / .16); background: var(--color-bone, #f6f0e7); padding: .75rem 1rem; font-size: .875rem; outline: none; }
      .seller-input:focus { border-color: var(--color-brass, #b7904d); box-shadow: 0 0 0 1px var(--color-brass, #b7904d); }
    `}</style>
    </div>
  );
}
