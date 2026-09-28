/**
 * Review & Q/A functions backed by the Kifayat Express API.
 */
import { api } from "./api";

export async function listProductReviews(productId: string): Promise<{
  reviews: any[];
  distribution: Record<number, number>;
}> {
  try {
    const data = await api.get<{ success: boolean; reviews: any[] }>(
      `/reviews/${productId}`,
    );
    const reviews = (data.reviews ?? []).map((r: any) => ({
      id: r._id,
      rating: r.rating,
      title: r.title || null,
      body: r.comment || r.body || "",
      verified_purchase: false,
      helpful_count: 0,
      created_at: r.createdAt,
      author_name: r.user?.name || "Anonymous",
    }));
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    reviews.forEach((r) => {
      dist[r.rating] = (dist[r.rating] ?? 0) + 1;
    });
    return { reviews, distribution: dist };
  } catch {
    return { reviews: [], distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
}

export async function submitReview(input: {
  product_id: string;
  rating: number;
  title?: string | null;
  body: string;
}): Promise<{ ok: boolean; verified: boolean }> {
  await api.post("/reviews", {
    productId: input.product_id,
    rating: input.rating,
    title: input.title,
    comment: input.body,
  });
  return { ok: true, verified: false };
}

export async function deleteMyReview(id: string): Promise<{ ok: boolean }> {
  await api.del(`/reviews/${id}`);
  return { ok: true };
}

export async function voteHelpful(_input: {
  review_id: string;
  vote: 1 | -1;
}): Promise<{ ok: boolean }> {
  // MongoDB backend doesn't have a vote endpoint — no-op
  return { ok: true };
}

// Q&A — MongoDB backend doesn't have these tables, return empty stubs
export async function listProductQA(
  _productId: string,
): Promise<{ questions: any[] }> {
  return { questions: [] };
}

export async function submitQuestion(input: {
  product_id: string;
  body: string;
}): Promise<{ ok: boolean }> {
  // No-op — feature not available in MongoDB backend
  console.warn("Q&A not implemented in backend", input);
  return { ok: true };
}

export async function submitAnswer(input: {
  question_id: string;
  body: string;
}): Promise<{ ok: boolean }> {
  console.warn("Q&A answers not implemented in backend", input);
  return { ok: true };
}
