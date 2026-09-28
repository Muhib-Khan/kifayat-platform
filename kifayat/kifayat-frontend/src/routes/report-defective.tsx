import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { SEO } from "@/components/seo/SEO";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/shop.functions";
import { useState, useRef, useCallback } from "react";
import { Search, X, Upload, Image, Video, Package, AlertTriangle } from "lucide-react";
import { submitDefectiveReport } from "@/lib/defective.api";
import type { UIProduct } from "@/lib/api";
import { optImage } from "@/lib/product-image-map";

export const Route = createFileRoute("/report-defective")({
  component: ReportDefectivePage,
});

function ProductSearch({ onSelect }: { onSelect: (p: UIProduct) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["product-search", query],
    queryFn: () => listProducts({ search: query, limit: 8 }).then((r) => r.products),
    enabled: query.length >= 2,
  });

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1.5">Search Product</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Type product name..."
          className="w-full h-11 pl-9 pr-3.5 rounded-md border border-border outline-none focus:border-primary text-sm"
        />
      </div>
      {open && query.length >= 2 && (isLoading || results.length > 0) && (
        <ul className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="px-3.5 py-2.5 flex items-center gap-3">
                  <div className="size-8 rounded bg-secondary animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded bg-secondary animate-pulse w-3/4" />
                    <div className="h-2.5 rounded bg-secondary animate-pulse w-1/3" />
                  </div>
                </li>
              ))
            : results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(p); setQuery(""); setOpen(false); }}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-secondary flex items-center gap-3"
                  >
                    {p.image_url ? (
                      <img src={optImage(p.image_url, 80)} alt="" className="size-8 rounded object-cover shrink-0" />
                    ) : (
                      <Package className="size-8 rounded object-cover shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">Rs. {p.price?.toLocaleString()}</p>
                    </div>
                  </button>
                </li>
              ))}
        </ul>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          No products found
        </div>
      )}
      {open && query.length >= 2 && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

function DefectiveForm() {
  const [selectedProduct, setSelectedProduct] = useState<UIProduct | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImages((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = "";
  }, []);

  const handleVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setVideos((prev) => [...prev, ...files].slice(0, 3));
    e.target.value = "";
  }, []);

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const removeVideo = (i: number) => setVideos((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError("Please describe the issue."); return; }
    if (images.length < 3) { setError(`Please upload at least 3 photos (${images.length} uploaded).`); return; }
    if (videos.length < 1) { setError(`Video Should Cover Complete Unboxing of the Products otherwise the request will not be entertained Thanks -Kifayat`); return; }
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (name.trim()) fd.append("name", name.trim());
      if (email.trim()) fd.append("email", email.trim());
      if (phone.trim()) fd.append("phone", phone.trim());
      if (selectedProduct) fd.append("productId", selectedProduct.id);
      fd.append("description", description.trim());
      images.forEach((f) => fd.append("images", f));
      videos.forEach((f) => fd.append("videos", f));
      await submitDefectiveReport(fd);
      setSuccess(true);
      setSelectedProduct(null);
      setName(""); setEmail(""); setPhone(""); setDescription("");
      setImages([]); setVideos([]);
    } catch (err: any) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-4">
        <div className="size-14 bg-green-100 rounded-full grid place-items-center mx-auto">
          <AlertTriangle className="size-7 text-green-600" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold">Report Submitted</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Thank you for your report. Our team will review the issue and get back to you within 24&ndash;48 hours.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 h-10 px-6 bg-foreground text-background rounded-md text-sm font-semibold hover:opacity-90 transition"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          <span className="block text-sm font-medium mb-1.5">Your Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
        </label>
        <label>
          <span className="block text-sm font-medium mb-1.5">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
        </label>
      </div>

      <label>
        <span className="block text-sm font-medium mb-1.5">Phone (optional)</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
      </label>

      <ProductSearch onSelect={setSelectedProduct} />

      {selectedProduct && (
        <div className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3.5 py-2.5 border border-border">
          {selectedProduct.image_url ? (
            <img src={optImage(selectedProduct.image_url, 80)} alt="" className="size-10 rounded object-cover shrink-0" />
          ) : (
            <Package className="size-10 rounded object-cover shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selectedProduct.name}</p>
            <p className="text-xs text-muted-foreground">Rs. {selectedProduct.price?.toLocaleString()}</p>
          </div>
          <button type="button" onClick={() => setSelectedProduct(null)} className="size-6 grid place-items-center hover:bg-border rounded shrink-0">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <label>
        <span className="block text-sm font-medium mb-1.5">Describe the Issue <span className="text-red-500">*</span></span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          required
          placeholder="What went wrong? Please describe the defect in detail..."
          className="w-full px-3.5 py-2.5 rounded-md border border-border outline-none focus:border-primary text-sm resize-none"
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <span className="block text-sm font-medium mb-1.5">Upload Images <span className="text-red-500">*</span> ({images.length}/10 min 3)</span>
          <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageChange} className="hidden" />
          <button type="button" onClick={() => imageRef.current?.click()} className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-brass hover:text-brass transition cursor-pointer">
            <Image className="size-6" strokeWidth={1.5} />
            <span className="text-xs">Click to add photos</span>
          </button>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((f, i) => (
                <div key={i} className="relative group size-14 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 size-4 bg-black/60 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 transition">
                    <X className="size-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="block text-sm font-medium mb-1.5">Upload Videos <span className="text-red-500">*</span> ({videos.length}/3 min 1)</span>
          <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">Video Should Cover Complete Unboxing of the Products otherwise the request will not be entertained Thanks -Kifayat</p>
          <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple onChange={handleVideoChange} className="hidden" />
          <button type="button" onClick={() => videoRef.current?.click()} className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-brass hover:text-brass transition cursor-pointer">
            <Video className="size-6" strokeWidth={1.5} />
            <span className="text-xs">Click to add videos</span>
          </button>
          {videos.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {videos.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded px-2.5 py-1.5 text-xs">
                  <Video className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => removeVideo(i)} className="size-4 grid place-items-center hover:bg-border rounded shrink-0">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 bg-foreground text-background rounded-md text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>Submitting&hellip;</>
        ) : (
          <><Upload className="size-4" strokeWidth={1.5} /> Submit Report</>
        )}
      </button>
    </form>
  );
}

function ReportDefectivePage() {
  return (
    <PageShell>
      <SEO
        title="Report a Defective Product"
        description="Submit a report for a defective product you received. Upload at least 3 images and 1 video to help our team review your case."
        path="/report-defective"
      />
      <PageHeader
        title="Report a Defective Product"
        subtitle="Upload at least 3 photos and 1 video so we can quickly resolve the issue."
        breadcrumbs={[{ label: "Home", to: "/" }, { label: "Report Defective" }]}
      />
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <DefectiveForm />
      </section>
    </PageShell>
  );
}
