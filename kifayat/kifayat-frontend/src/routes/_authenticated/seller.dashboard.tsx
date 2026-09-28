import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ImagePlus, Package, Plus, RefreshCw, Store, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { sellerCreateProduct, sellerDeleteProduct, sellerListProducts, sellerUpdateProduct } from "@/lib/seller.functions";
import { getSellerAnalytics } from "@/lib/seller.functions";
import { SellerAnalytics } from "@/components/seller/SellerAnalytics";
import { useAuth } from "@/lib/auth-store";

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
  imageUrl: string;
  videoUrl: string;
};

const emptyForm: FormState = {
  name: "", description: "", retailPrice: "", stock: "0", category: "Uncategorized",
  weight: "0", imageUrl: "", videoUrl: "",
};

function SellerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["seller", "products"],
    queryFn: sellerListProducts,
  });
  const { data: analyticsData, isLoading: analyticsLoading, isError: analyticsError, refetch: refetchAnalytics } = useQuery({
    queryKey: ["seller", "analytics"],
    queryFn: getSellerAnalytics,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        retailPrice: Number(form.retailPrice),
        stock: Number(form.stock),
        category: form.category.trim() || "Uncategorized",
        weight: Number(form.weight) || 0,
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
      retailPrice: String(product.price || 0),
      stock: String(product.stock || 0),
      category: product.category_name || "Uncategorized",
      weight: String(product.weight || 0),
      imageUrl: product.image_url || "",
      videoUrl: product.videoUrl || "",
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const updateField = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="min-h-[70vh] bg-bone">
      <section className="border-b border-coal/10 bg-coal text-bone">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-brass text-[10px] mb-3">Seller workspace</p>
              <h1 className="font-display italic text-4xl sm:text-5xl">{user?.storeName || "Faiza's Store"}</h1>
              <p className="mt-3 text-bone/65 text-sm max-w-md">Add and manage the products that appear in your public store and across Kifayat.</p>
            </div>
            <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setFormOpen(true); }} className="inline-flex items-center gap-2 bg-brass text-coal px-5 py-3 text-sm font-semibold hover:bg-brass/90 transition-colors">
              <Plus className="size-4" /> Add product
            </button>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-bone/70">
            <Package className="size-4 text-brass" />
            <span>{products.length} {products.length === 1 ? "product" : "products"} in your store</span>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        {analyticsLoading ? (
          <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Loading seller analytics">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 bg-paper border border-coal/10 animate-pulse" />)}
          </div>
        ) : analyticsError ? (
          <div className="mb-10 border border-red-500/20 bg-red-50/60 p-8 text-center">
            <p className="font-display italic text-2xl text-red-900">Seller intelligence could not load.</p>
            <p className="mt-2 text-sm text-red-900/65">Your products remain available below. Retry to reload the account analysis.</p>
            <button type="button" onClick={() => refetchAnalytics()} className="mt-5 inline-flex items-center gap-2 bg-coal px-4 py-2.5 text-sm font-semibold text-bone hover:bg-coal/90">
              <RefreshCw className="size-4" /> Retry analysis
            </button>
          </div>
        ) : analyticsData?.analytics ? <SellerAnalytics analytics={analyticsData.analytics} seller={analyticsData.seller} /> : null}
        {formOpen && (
          <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="mb-10 border border-coal/15 bg-paper p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="eyebrow text-brass text-[10px] mb-1">{editingId ? "Edit listing" : "New listing"}</p>
                <h2 className="font-display italic text-2xl">{editingId ? "Update product" : "Add a product"}</h2>
              </div>
              <button type="button" onClick={resetForm} aria-label="Close product form" className="p-2 text-coal/50 hover:text-coal"><X className="size-5" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <label className="sm:col-span-2"><span className="field-label">Product name</span><input required value={form.name} onChange={(e) => updateField("name", e.target.value)} className="seller-input" placeholder="e.g. Handcrafted leather wallet" /></label>
              <label className="sm:col-span-2"><span className="field-label">Description</span><textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} className="seller-input min-h-24" placeholder="Tell buyers what makes it useful." /></label>
              <label><span className="field-label">Selling price (PKR)</span><input required min="0" type="number" value={form.retailPrice} onChange={(e) => updateField("retailPrice", e.target.value)} className="seller-input" /></label>
              <label><span className="field-label">Stock</span><input min="0" type="number" value={form.stock} onChange={(e) => updateField("stock", e.target.value)} className="seller-input" /></label>
              <label><span className="field-label">Category</span><input value={form.category} onChange={(e) => updateField("category", e.target.value)} className="seller-input" placeholder="Fashion" /></label>
              <label><span className="field-label">Weight (kg)</span><input min="0" step="0.01" type="number" value={form.weight} onChange={(e) => updateField("weight", e.target.value)} className="seller-input" /></label>
              <label className="sm:col-span-2"><span className="field-label">Image URL</span><input type="url" value={form.imageUrl} onChange={(e) => updateField("imageUrl", e.target.value)} className="seller-input" placeholder="https://…" /></label>
              <label className="sm:col-span-2"><span className="field-label">Video URL (optional)</span><input type="url" value={form.videoUrl} onChange={(e) => updateField("videoUrl", e.target.value)} className="seller-input" placeholder="https://…" /></label>
            </div>
            <div className="flex flex-wrap gap-3 mt-7">
              <button disabled={saveMutation.isPending} type="submit" className="bg-coal text-bone px-5 py-3 text-sm font-semibold hover:bg-coal/90 disabled:opacity-50">{saveMutation.isPending ? "Saving…" : editingId ? "Save changes" : "Publish product"}</button>
              <button type="button" onClick={resetForm} className="border border-coal/20 px-5 py-3 text-sm hover:bg-bone transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {isLoading ? <p className="text-sm text-coal/60">Loading your products…</p> : products.length === 0 ? (
          <div className="border border-dashed border-coal/20 py-20 text-center">
            <ImagePlus className="size-10 mx-auto text-coal/20" strokeWidth={1.2} />
            <h2 className="mt-4 font-display italic text-2xl">Your shelf is empty</h2>
            <p className="mt-2 text-sm text-coal/60">Add your first product to show it in Faiza&apos;s Store.</p>
            <button type="button" onClick={() => setFormOpen(true)} className="mt-6 text-sm text-brass underline underline-offset-4">Add the first product</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product: any) => (
              <article key={product.id} className="border border-coal/10 bg-paper overflow-hidden">
                <div className="aspect-[4/3] bg-bone relative">
                  {product.image_url ? <img src={product.image_url} alt="" className="size-full object-contain" /> : <div className="size-full grid place-items-center text-coal/15"><Store className="size-12" /></div>}
                  <span className={`absolute top-3 left-3 px-2 py-1 text-[10px] eyebrow ${product.inStock ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{product.inStock ? "Live" : "Out of stock"}</span>
                </div>
                <div className="p-5">
                  <p className="eyebrow text-[10px] text-coal/45">{product.category_name || "Uncategorized"}</p>
                  <h3 className="mt-1 font-medium leading-snug line-clamp-2">{product.name}</h3>
                  <div className="flex items-center justify-between mt-4"><span className="font-display italic text-lg">Rs {Number(product.price).toLocaleString("en-PK")}</span><span className="text-xs text-coal/55">{product.stock} in stock</span></div>
                  <div className="flex gap-2 mt-5 pt-4 border-t border-coal/10">
                    <button type="button" onClick={() => editProduct(product)} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-coal/15 py-2.5 text-sm hover:bg-bone transition-colors"><Edit3 className="size-3.5" /> Edit</button>
                    <button type="button" onClick={() => { if (window.confirm(`Delete "${product.name}"?`)) deleteMutation.mutate(product.id); }} disabled={deleteMutation.isPending} className="px-3 border border-red-500/20 text-red-600 hover:bg-red-50 transition-colors" aria-label={`Delete ${product.name}`}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <style>{`
        .field-label { display: block; margin-bottom: .5rem; font: 600 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: rgb(45 45 45 / .58); }
        .seller-input { width: 100%; border: 1px solid rgb(45 45 45 / .16); background: var(--color-bone, #f6f0e7); padding: .75rem 1rem; font-size: .875rem; outline: none; }
        .seller-input:focus { border-color: var(--color-brass, #b7904d); box-shadow: 0 0 0 1px var(--color-brass, #b7904d); }
      `}</style>
    </div>
  );
}