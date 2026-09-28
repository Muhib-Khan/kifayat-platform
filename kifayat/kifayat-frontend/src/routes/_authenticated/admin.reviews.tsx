import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminListReviews,
  adminDeleteReviewById,
  adminUpdateReviewById,
  adminToggleReviewPin,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Star, Search, Loader2, Pin, Trash2, Edit2, MessageSquare, Package, Save, X } from "lucide-react";
import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: AdminReviews,
});

const fmtDate = (v: string) =>
  v ? new Date(v).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function AdminReviews() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ rating: number; comment: string; response: string }>({ rating: 5, comment: "", response: "" });

  const debounceRef = { t: null as ReturnType<typeof setTimeout> | null };
  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.t) clearTimeout(debounceRef.t);
    debounceRef.t = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 350);
  };

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (ratingFilter) params.rating = ratingFilter;
  if (debouncedSearch) params.q = debouncedSearch;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", page, ratingFilter, debouncedSearch],
    queryFn: () => adminListReviews(params),
  });

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const average = data?.average ?? 0;
  const dist = data?.ratingDistribution ?? {};

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-reviews"] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteReviewById(id),
    onSuccess: () => { toast.success("Review deleted."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => adminUpdateReviewById(id, payload),
    onSuccess: () => { toast.success("Review updated."); setEditingId(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Update failed."),
  });

  const pinMut = useMutation({
    mutationFn: (id: string) => adminToggleReviewPin(id),
    onSuccess: () => { toast.success("Pin status updated."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Pin failed."),
  });

  const startEdit = (r: any) => {
    setEditingId(r._id);
    setEditForm({ rating: r.rating, comment: r.comment ?? "", response: r.response ?? "" });
  };

  const StarRating = ({ rating, interactive = false, onRate }: { rating: number, interactive?: boolean, onRate?: (r: number) => void }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRate?.(s)}
            className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
          >
            <Star className={`size-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground"}`} strokeWidth={s <= rating ? 0 : 1.5} />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass"></span> Customer voice
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Reviews<span className="text-brass">.</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-2 font-medium">Moderate all product reviews across the catalogue.</p>
      </div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-5">
          <p className="eyebrow text-muted-foreground mb-2">Total Reviews</p>
          <p className="font-display text-4xl font-bold text-foreground leading-none">{total}</p>
        </div>
        <div className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-5">
          <p className="eyebrow text-muted-foreground mb-2">Average Rating</p>
          <div className="flex items-end gap-2">
            <p className="font-display text-4xl font-bold text-brass leading-none">{average}</p>
            <p className="text-muted-foreground font-bold mb-1">/ 5</p>
          </div>
        </div>
        {total > 0 && (
          <div className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-5 col-span-2">
            <p className="eyebrow text-muted-foreground mb-3">Rating Breakdown</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = dist[s] ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-3 text-xs font-bold">
                    <span className="w-8 text-right text-muted-foreground flex items-center justify-end gap-1">{s} <Star className="size-3 fill-amber-400 text-amber-400" strokeWidth={0} /></span>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-brass rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search review text…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-card shadow-e1 border border-border rounded-xl text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center bg-card border border-border shadow-e1 px-2 py-1.5 rounded-xl">
          {[{ label: "All", val: "" }, { label: "5", val: "5" }, { label: "4", val: "4" }, { label: "3", val: "3" }, { label: "2", val: "2" }, { label: "1", val: "1" }].map(({ label, val }) => (
            <button
              key={val}
              onClick={() => { setRatingFilter(ratingFilter === val ? "" : val); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${ratingFilter === val ? "bg-coal text-bone shadow-sm" : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
            >
              {label} {val !== "" && <Star className={`size-3 ${ratingFilter === val ? "fill-bone" : "fill-current"}`} strokeWidth={0} />}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card shadow-sm border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/2" />
              <TextSkeleton lines={3} />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card shadow-e1 border border-border rounded-2xl flex flex-col items-center">
          <MessageSquare className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">{debouncedSearch || ratingFilter ? "No reviews match your filters." : "No reviews submitted yet."}</p>
        </motion.div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-4">
          <p className="eyebrow text-muted-foreground">Showing {reviews.length} of {total} reviews</p>
          <div className="grid md:grid-cols-2 gap-4">
            {reviews.map((r: any) => (
              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} key={r._id} className={`bg-card shadow-sm hover:shadow-e1 transition-shadow duration-300 rounded-xl p-6 border ${r.pinned ? "border-brass shadow-[0_0_15px_rgba(201,161,74,0.15)]" : "border-border"}`}>
                {editingId === r._id ? (
                  <div className="space-y-4">
                    <StarRating rating={editForm.rating} interactive onRate={(s) => setEditForm(f => ({ ...f, rating: s }))} />
                    <textarea
                      rows={3} value={editForm.comment}
                      onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl p-4 text-sm font-medium text-foreground resize-none focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm"
                      placeholder="Review comment"
                    />
                    <input
                      value={editForm.response} placeholder="Admin response (optional)"
                      onChange={(e) => setEditForm((f) => ({ ...f, response: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl p-4 text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm"
                    />
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => updateMut.mutate({ id: r._id, payload: editForm })}
                        disabled={updateMut.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-coal text-bone rounded-xl font-bold hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1"
                      >
                        {updateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border border-border bg-card text-foreground font-bold rounded-xl hover:bg-secondary transition-colors shadow-sm">
                        <X className="size-4" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <StarRating rating={r.rating} />
                          {r.pinned && <span className="text-[10px] uppercase tracking-widest font-bold bg-brass/10 text-brass border border-brass/20 px-2 py-0.5 rounded flex items-center gap-1"><Pin className="size-3" /> Pinned</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{r.user?.name ?? "Unknown User"}</span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">{r.user?.email ?? ""}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</span>
                    </div>

                    {/* Product link */}
                    {r.product && (
                      <div className="flex items-center gap-3 mb-4 bg-secondary/30 p-2 rounded-lg border border-border">
                        {r.product.imageUrl ? (
                          <img src={r.product.imageUrl} alt={r.product.name} className="size-8 object-cover rounded shadow-sm border border-border" />
                        ) : (
                          <div className="size-8 bg-secondary rounded flex items-center justify-center border border-border shadow-sm"><Package className="size-3 text-muted-foreground" /></div>
                        )}
                        <span className="text-xs font-bold text-foreground line-clamp-1">{r.product.name}</span>
                      </div>
                    )}

                    <p className="text-sm font-medium text-foreground leading-relaxed mb-4">{r.comment}</p>

                    {r.response && (
                      <div className="bg-secondary/50 border border-border pl-4 py-3 mb-4 rounded-xl relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brass opacity-50" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-brass block mb-1">Admin Response</span>
                        <span className="text-sm font-medium text-foreground">{r.response}</span>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-border mt-auto">
                      <button
                        onClick={() => startEdit(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-border bg-card text-foreground rounded-lg hover:bg-secondary transition-colors shadow-sm"
                      >
                        <Edit2 className="size-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => pinMut.mutate(r._id)}
                        disabled={pinMut.isPending}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-lg transition-colors shadow-sm disabled:opacity-50 ${r.pinned ? "border-brass/30 bg-brass/5 text-brass hover:bg-brass/10" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                      >
                        <Pin className={`size-3.5 ${r.pinned ? "fill-brass" : ""}`} /> {r.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => { if (window.confirm("Delete this review permanently?")) deleteMut.mutate(r._id); }}
                        disabled={deleteMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-500/30 bg-red-500/5 text-red-600 rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-colors shadow-sm ml-auto"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Previous</button>
          <span className="flex items-center text-sm font-bold text-muted-foreground">{page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Next</button>
        </div>
      )}
    </div>
  );
}
