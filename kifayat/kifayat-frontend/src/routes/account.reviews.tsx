import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/account/reviews")({
  component: Reviews,
});

function Reviews() {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow text-muted-foreground">§ Your voice</p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
          Reviews<span className="text-brass">.</span>
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Your reviews will appear here after you purchase and review products.
      </p>
    </div>
  );
}
