import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Loader2, ShoppingBag } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/confirm-order")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
  component: ConfirmOrder,
});

type ConfirmState =
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "already_confirmed" }
  | { status: "expired" }
  | { status: "error"; message: string }
  | { status: "no_token" };

function ConfirmOrder() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<ConfirmState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "no_token" });
      return;
    }

    let cancelled = false;

    async function confirmOrder() {
      try {
        const res = await fetch(`/api/orders/confirm/${encodeURIComponent(token)}`, {
          method: "GET",
          credentials: "include",
        });

        if (cancelled) return;

        let data: any;
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (res.ok && data.success) {
          // Check if it was already confirmed
          if (data.message?.toLowerCase().includes("already")) {
            setState({ status: "already_confirmed" });
          } else {
            setState({ status: "success", message: data.message ?? "Order confirmed!" });
          }
        } else if (data.expired) {
          setState({ status: "expired" });
        } else {
          setState({ status: "error", message: data.message ?? "Something went wrong." });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Network error — please try again." });
        }
      }
    }

    confirmOrder();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <PageShell>
      <section className="min-h-[70vh] flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center">
          {state.status === "loading" && (
            <div className="space-y-6">
              <div className="flex justify-center gap-2" aria-hidden>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="size-10 rounded-full" />
                ))}
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-8 w-64 mx-auto" />
                <Skeleton className="h-3 w-48 mx-auto" />
              </div>
            </div>
          )}

          {state.status === "success" && (
            <div className="space-y-6">
              <CheckCircle className="size-16 mx-auto text-green-500" strokeWidth={1.5} />
              <div>
                <p className="eyebrow text-muted-foreground mb-2">§ All done</p>
                <h1 className="font-display italic text-4xl lg:text-5xl">
                  Order confirmed<span className="text-brass">.</span>
                </h1>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Your order has been confirmed and is now being processed. You'll
                  receive updates as it moves through the pipeline.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/account/orders"
                  className="inline-flex items-center justify-center gap-2 bg-coal text-bone px-5 py-2.5 text-sm font-medium rounded hover:bg-coal/90 transition"
                >
                  <ShoppingBag className="size-4" strokeWidth={1.5} />
                  View my orders
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 border border-border px-5 py-2.5 text-sm font-medium rounded hover:bg-muted transition"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          )}

          {state.status === "already_confirmed" && (
            <div className="space-y-6">
              <CheckCircle className="size-16 mx-auto text-green-500" strokeWidth={1.5} />
              <div>
                <h1 className="font-display italic text-4xl">
                  Already confirmed<span className="text-brass">.</span>
                </h1>
                <p className="text-muted-foreground mt-3 text-sm">
                  This order has already been confirmed. No further action needed.
                </p>
              </div>
              <Link
                to="/account/orders"
                className="inline-flex items-center justify-center gap-2 bg-coal text-bone px-5 py-2.5 text-sm font-medium rounded hover:bg-coal/90 transition"
              >
                <ShoppingBag className="size-4" strokeWidth={1.5} />
                View my orders
              </Link>
            </div>
          )}

          {state.status === "expired" && (
            <div className="space-y-6">
              <Clock className="size-16 mx-auto text-amber-500" strokeWidth={1.5} />
              <div>
                <h1 className="font-display italic text-4xl">
                  Link expired<span className="text-brass">.</span>
                </h1>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  The 24-hour confirmation window has passed and this order has
                  been automatically cancelled. You can place a new order at any time.
                </p>
              </div>
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 bg-coal text-bone px-5 py-2.5 text-sm font-medium rounded hover:bg-coal/90 transition"
              >
                Shop again
              </Link>
            </div>
          )}

          {(state.status === "error" || state.status === "no_token") && (
            <div className="space-y-6">
              <XCircle className="size-16 mx-auto text-destructive" strokeWidth={1.5} />
              <div>
                <h1 className="font-display italic text-4xl">
                  Invalid link<span className="text-brass">.</span>
                </h1>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {state.status === "no_token"
                    ? "No confirmation token was found in this URL. Please use the link from your order confirmation email."
                    : (state as any).message}
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 border border-border px-5 py-2.5 text-sm font-medium rounded hover:bg-muted transition"
              >
                Go home
              </Link>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
