import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, MessageCircle, ShieldCheck, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import {
  listProductReviews,
  submitReview,
  listProductQA,
  submitQuestion,
  submitAnswer,
  voteHelpful,
} from "@/lib/reviews.functions";
import { useAuth } from "@/lib/auth-store";
import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

export function ReviewsSection({ productId, fallbackRating, fallbackCount }: { productId: string; fallbackRating?: number; fallbackCount?: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["reviews", productId], queryFn: () => listProductReviews(productId) });
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const reviews = data?.reviews ?? [];
  const dist = data?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const total = reviews.length;
  const avg = total ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / total : (fallbackRating ?? 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error("Sign in to leave a review."); return; }
    try {
      await submitReview({ product_id: productId, rating, title: title || null, body });
      toast.success("Review posted.");
      setShowForm(false); setBody(""); setTitle(""); setRating(5);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
    } catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }

  return (
    <section id="reviews" className="border-t border-coal/10 py-16 lg:py-24">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        <div className="grid lg:grid-cols-[360px_1fr] gap-10 lg:gap-16">
          <div>
            <p className="eyebrow text-coal/50 mb-3">§ Customer voice</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.95]">Reviews<span className="text-brass">.</span></h2>
            <div className="mt-8 flex items-baseline gap-4">
              <span className="font-display text-7xl text-brass">{avg.toFixed(1)}</span>
              <div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`size-5 ${i <= Math.round(avg) ? "fill-brass text-brass" : "text-coal/20"}`} strokeWidth={1.2} />
                  ))}
                </div>
                <p className="eyebrow text-coal/50 mt-2 text-[10px]">{total || (fallbackCount ?? 0)} reviews</p>
              </div>
            </div>
            <div className="mt-8 space-y-2">
              {[5, 4, 3, 2, 1].map((r) => {
                const count = (dist as any)[r] ?? 0;
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={r} className="flex items-center gap-3 text-sm">
                    <span className="w-6 flex items-center gap-1">{r}<Star className="size-3 fill-brass text-brass" strokeWidth={1.2} /></span>
                    <div className="flex-1 h-1.5 bg-coal/10 overflow-hidden">
                      <div className="h-full bg-brass" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-coal/50">{count}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="mt-8 w-full bg-coal text-bone eyebrow py-3 hover:bg-brass hover:text-coal transition"
            >
              {showForm ? "Cancel" : "Write a review"}
            </button>
          </div>

          <div>
            {showForm && (
              <form onSubmit={submit} className="mb-10 border border-coal/15 p-6 bg-paper">
                <p className="eyebrow text-coal/60 mb-3">Your rating</p>
                <div className="flex gap-1 mb-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button type="button" key={i} onClick={() => setRating(i)}>
                      <Star className={`size-7 ${i <= rating ? "fill-brass text-brass" : "text-coal/20"} hover:text-brass transition`} strokeWidth={1.2} />
                    </button>
                  ))}
                </div>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline (optional)"
                  className="w-full h-11 px-3 mb-3 bg-bone border border-coal/15 text-sm outline-none focus:border-coal" />
                <textarea
                  value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell others what you think…" required minLength={3}
                  rows={4}
                  className="w-full p-3 bg-bone border border-coal/15 text-sm outline-none focus:border-coal resize-none" />
                <button type="submit" className="mt-3 bg-brass text-coal eyebrow px-6 py-3 hover:bg-coal hover:text-bone transition">Post review</button>
              </form>
            )}

            {isLoading ? (
              <ul className="divide-y divide-coal/10" aria-hidden>
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="py-5 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <TextSkeleton lines={2} />
                  </li>
                ))}
              </ul>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-coal/60 py-10 border border-dashed border-coal/15 text-center">No reviews yet — be the first.</p>
            ) : (
              <ul className="divide-y divide-coal/10">
                {reviews.map((r: any) => (
                  <li key={r.id} className="py-5 first:pt-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className={`size-4 ${i <= r.rating ? "fill-brass text-brass" : "text-coal/20"}`} strokeWidth={1.2} />
                        ))}
                      </div>
                      <span className="font-display italic text-lg">{r.author_name}</span>
                      {r.verified_purchase && (
                        <span className="flex items-center gap-1 eyebrow text-[10px] text-brass">
                          <ShieldCheck className="size-3" strokeWidth={1.6} /> Verified
                        </span>
                      )}
                      <span className="eyebrow text-coal/40 text-[10px]">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.title && <p className="font-medium mb-1">{r.title}</p>}
                    <p className="text-sm text-coal/80 leading-relaxed">{r.body}</p>
                    <button
                      onClick={async () => {
                        if (!user) { toast.error("Sign in to vote."); return; }
                        try {
                          await voteHelpful({ review_id: r.id, vote: 1 });
                          toast.success("Marked as helpful.");
                          qc.invalidateQueries({ queryKey: ["reviews", productId] });
                        } catch (e: any) { toast.error(e?.message ?? "Failed."); }
                      }}
                      className="mt-3 inline-flex items-center gap-2 text-xs text-coal/60 hover:text-brass transition"
                    >
                      <ThumbsUp className="size-3.5" strokeWidth={1.4} /> Helpful ({r.helpful_count ?? 0})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function QASection({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["qa", productId], queryFn: () => listProductQA(productId) });
  const questions = data?.questions ?? [];
  const [ask, setAsk] = useState("");
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  async function postQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error("Sign in to ask."); return; }
    try { await submitQuestion({ product_id: productId, body: ask }); setAsk(""); toast.success("Question posted."); qc.invalidateQueries({ queryKey: ["qa", productId] }); }
    catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }
  async function postAnswer(qid: string, e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error("Sign in to answer."); return; }
    try { await submitAnswer({ question_id: qid, body: answer }); setAnswer(""); setAnswering(null); toast.success("Answer posted."); qc.invalidateQueries({ queryKey: ["qa", productId] }); }
    catch (e: any) { toast.error(e?.message ?? "Failed."); }
  }

  return (
    <section className="border-t border-coal/10 py-16 lg:py-24 bg-paper">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        <div className="grid lg:grid-cols-[360px_1fr] gap-10 lg:gap-16">
          <div>
            <p className="eyebrow text-coal/50 mb-3">§ Q&A</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.95]">Questions<span className="text-brass">.</span></h2>
            <p className="text-coal/60 text-sm mt-4 max-w-xs">Ask anything about the object — sellers and other buyers will answer.</p>
            <form onSubmit={postQuestion} className="mt-6">
              <textarea
                value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What would you like to know?" rows={3} required minLength={3}
                className="w-full p-3 bg-bone border border-coal/15 text-sm outline-none focus:border-coal resize-none"
              />
              <button type="submit" className="mt-3 w-full bg-coal text-bone eyebrow py-3 hover:bg-brass hover:text-coal transition">Ask question</button>
            </form>
          </div>

          <div>
            {isLoading ? (
              <ul className="space-y-5" aria-hidden>
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="border border-coal/10 p-5 bg-bone space-y-2.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-4 rounded-full" />
                      <Skeleton className="h-3.5 w-1/3" />
                    </div>
                    <TextSkeleton lines={2} />
                  </li>
                ))}
              </ul>
            ) : questions.length === 0 ? (
              <p className="text-sm text-coal/60 py-10 border border-dashed border-coal/15 text-center bg-bone">No questions yet.</p>
            ) : (
              <ul className="space-y-5">
                {questions.map((q: any) => (
                  <li key={q.id} className="border border-coal/10 p-5 bg-bone">
                    <div className="flex items-start gap-3">
                      <MessageCircle className="size-4 text-brass mt-1 shrink-0" strokeWidth={1.4} />
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{q.body}</p>
                        <p className="eyebrow text-coal/40 text-[10px] mt-2">{q.author_name} · {new Date(q.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {q.answers?.length > 0 && (
                      <ul className="mt-4 pl-7 space-y-3 border-l-2 border-brass/20">
                        {q.answers.map((a: any) => (
                          <li key={a.id}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="eyebrow text-[10px]">{a.is_seller ? <span className="text-brass">Kifayat</span> : a.author_name}</span>
                              {a.is_seller && <span className="eyebrow text-[9px] px-1.5 py-0.5 bg-brass text-coal">Seller</span>}
                            </div>
                            <p className="text-sm text-coal/80">{a.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {answering === q.id ? (
                      <form onSubmit={(e) => postAnswer(q.id, e)} className="mt-3 pl-7">
                        <textarea
                          value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" rows={2} required minLength={3}
                          className="w-full p-2 bg-paper border border-coal/15 text-sm outline-none focus:border-coal resize-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <button type="submit" className="eyebrow text-xs bg-coal text-bone px-4 py-1.5 hover:bg-brass hover:text-coal transition">Post</button>
                          <button type="button" onClick={() => setAnswering(null)} className="eyebrow text-xs px-4 py-1.5 hover:bg-paper transition">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setAnswering(q.id)} className="mt-2 pl-7 eyebrow text-xs text-coal/60 hover:text-brass transition">
                        Answer this →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
