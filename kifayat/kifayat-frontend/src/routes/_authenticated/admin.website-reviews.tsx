import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminDeleteWebsiteReview,
  adminGetWebsiteReviews,
  adminToggleWebsiteReviewPin,
  adminUpdateWebsiteReview,
} from "@/lib/admin.functions";
import { motion } from "framer-motion";
import { Star, Loader2, MessageSquareHeart, Pin, Edit2, Trash2, Save, X } from "lucide-react";
import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/website-reviews")({
  component: WebsiteReviewsPage,
});

function WebsiteReviewsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ rating: number; comment: string; response: string }>({ rating: 5, comment: "", response: "" });

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (filter) params.filter = filter;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-website-reviews", page, filter],
    queryFn: () => adminGetWebsiteReviews(params),
  });

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const average = data?.average ?? 0;
  const dist = data?.ratingDistribution ?? {};

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-website-reviews"] });

  const updateMut = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: any }) => adminUpdateWebsiteReview(id, payload), onSuccess: () => { setEditingId(null); invalidate(); } });
  const deleteMut = useMutation({ mutationFn: (id: string) => adminDeleteWebsiteReview(id), onSuccess: invalidate });
  const pinMut = useMutation({ mutationFn: (id: string) => adminToggleWebsiteReviewPin(id), onSuccess: invalidate });

  const startEdit = (r: any) => { setEditingId(r._id); setEditForm({ rating: r.rating, comment: r.comment, response: r.response ?? "" }); };

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
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass"></span> Site presentation
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Website Reviews<span className="text-brass">.</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-2 font-medium">Manage customer reviews showcased on the homepage.</p>
      </div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-6">
        <div className="grid grid-cols-2 md:grid-cols-1 gap-6">
          <div className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-6">
            <p className="eyebrow text-muted-foreground mb-3">Average Rating</p>
            <div className="flex items-end gap-2">
              <p className="font-display text-5xl font-bold text-brass leading-none">{average}</p>
              <p className="text-muted-foreground font-bold mb-1.5 text-lg">/ 5</p>
            </div>
          </div>
          <div className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-6">
            <p className="eyebrow text-muted-foreground mb-3">Total Reviews</p>
            <p className="font-display text-5xl font-bold text-foreground leading-none">{total}</p>
          </div>
        </div>

        {/* Rating distribution */}
        {total > 0 && (
          <div className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-6 md:col-span-2">
            <p className="eyebrow text-muted-foreground mb-4">Rating Breakdown</p>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = dist[s] ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-4 text-sm font-bold">
                    <span className="w-8 text-muted-foreground text-right flex items-center justify-end gap-1">{s} <Star className="size-3.5 fill-amber-400 text-amber-400" strokeWidth={0} /></span>
                    <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-brass rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Filter buttons */}
      <div className="flex gap-3 flex-wrap bg-card border border-border shadow-e1 p-2 rounded-2xl">
        {[{ key: "", label: "All Reviews" }, { key: "good", label: "Good (4-5)" }, { key: "normal", label: "Normal (3)" }, { key: "bad", label: "Bad (1-2)" }].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(filter === key ? "" : key); setPage(1); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${filter === key ? "bg-coal text-bone shadow-e1" : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {label} {key !== "" && <Star className={`size-3.5 inline ml-1.5 -translate-y-px ${filter === key ? "fill-bone" : "fill-current"}`} strokeWidth={0} />}
          </button>
        ))}
      </div>

      {/* Reviews */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6" aria-hidden>
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
          <MessageSquareHeart className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">No website reviews yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Adjust filters or wait for submissions.</p>
        </motion.div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="grid md:grid-cols-2 gap-6">
          {reviews.map((r: any) => (
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} key={r._id} className={`bg-card shadow-sm hover:shadow-e1 transition-shadow duration-300 rounded-xl p-6 border ${r.pinned ? "border-brass shadow-[0_0_15px_rgba(201,161,74,0.15)]" : "border-border"}`}>
              {editingId === r._id ? (
                <div className="space-y-4">
                  <StarRating rating={editForm.rating} interactive onRate={(s) => setEditForm(f => ({ ...f, rating: s }))} />
                  <textarea rows={3} value={editForm.comment} onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl p-4 text-sm font-medium text-foreground resize-none focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm" />
                  <input value={editForm.response} placeholder="Admin response (optional)"
                    onChange={(e) => setEditForm((f) => ({ ...f, response: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl p-4 text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all shadow-sm" />
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => updateMut.mutate({ id: r._id, payload: editForm })}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-coal text-bone rounded-xl font-bold hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1">
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
                      <span className="font-bold text-sm text-foreground">{r.name}</span>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground leading-relaxed mb-4">{r.comment}</p>
                  {r.response && (
                    <div className="bg-secondary/50 border border-border pl-4 py-3 mb-4 rounded-xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brass opacity-50" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-brass block mb-1">Admin Response</span>
                      <span className="text-sm font-medium text-foreground">{r.response}</span>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4 border-t border-border mt-auto">
                    <button onClick={() => startEdit(r)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-border bg-card text-foreground rounded-lg hover:bg-secondary transition-colors shadow-sm"><Edit2 className="size-3.5" /> Edit</button>
                    <button onClick={() => pinMut.mutate(r._id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-lg transition-colors shadow-sm disabled:opacity-50 ${r.pinned ? "border-brass/30 bg-brass/5 text-brass hover:bg-brass/10" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                      <Pin className={`size-3.5 ${r.pinned ? "fill-brass" : ""}`} /> {r.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button onClick={() => { if (window.confirm("Delete this review?")) deleteMut.mutate(r._id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-500/30 bg-red-500/5 text-red-600 rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-colors shadow-sm ml-auto"><Trash2 className="size-3.5" /> Delete</button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Previous</button>
          <span className="flex items-center text-sm font-bold text-muted-foreground">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Next</button>
        </div>
      )}
    </div>
  );
}
