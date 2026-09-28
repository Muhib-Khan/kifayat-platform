import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { submitWebsiteReview } from "@/lib/shop.functions";

/**
 * Customer-facing form for leaving a site review.
 * Requires a logged-in user; shows login prompt otherwise.
 */
export function WebsiteReviewForm() {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="border border-coal/15 bg-white/40 p-6 text-center">
        <p className="eyebrow text-coal/60 mb-2">Bought something recently?</p>
        <p className="text-sm text-coal/65 mb-4">
          Log in to tell other shoppers what you thought.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-coal text-bone eyebrow px-5 py-2.5 text-xs hover:bg-brass hover:text-coal transition"
        >
          Log in to leave a review
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || !comment.trim()) return;
    setStatus("submitting");
    setError("");
    try {
      await submitWebsiteReview({ rating, comment: comment.trim() });
      setStatus("done");
      setComment("");
    } catch {
      setStatus("error");
      setError("Something went wrong — please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="border border-brass/40 bg-brass/5 p-6 flex items-start gap-3">
        <CheckCircle2 className="size-5 text-brass mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-display italic text-xl">Thank you!</p>
          <p className="text-sm text-coal/70 mt-1">
            Your review is in. We'll feature it here once it's approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-coal/15 bg-white/40 p-6"
    >
      <p className="eyebrow text-coal/60 mb-1">Your experience</p>
      <h3 className="font-display italic text-2xl leading-tight mb-4">
        Tell others how it went<span className="text-brass">.</span>
      </h3>

      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => {
          const n = i + 1;
          const filled = hover ? n <= hover : n <= rating;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-0.5"
            >
              <Star
                className={`size-7 ${filled ? "fill-brass text-brass" : "text-coal/25"}`}
                strokeWidth={1}
              />
            </button>
          );
        })}
        <span className="ml-3 text-sm text-coal/60">{rating}/5</span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        required
        maxLength={600}
        rows={3}
        placeholder="What did you order and how did it go?"
        className="w-full px-4 py-3 text-sm bg-transparent border border-coal/20 focus:border-coal outline-none resize-none placeholder:text-coal/40"
      />

      {status === "error" && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting" || !comment.trim()}
        className="mt-4 inline-flex items-center gap-2 bg-coal text-bone eyebrow px-6 py-3 text-xs hover:bg-brass hover:text-coal transition disabled:opacity-40 disabled:pointer-events-none"
      >
        {status === "submitting" ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
