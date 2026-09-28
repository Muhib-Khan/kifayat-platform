import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/lib/shop.functions";
import { useAuth } from "@/lib/auth-store";
import { Package } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { fmtDatePK, fmtTimePK } from "@/lib/format";

export const Route = createFileRoute("/account/orders")({
  component: Orders,
});

const tone: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  confirmed: "bg-blue-100 text-blue-900",
  shipped: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

function Orders() {
  const { user, loading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: listMyOrders,
    enabled: !!user,
  });

  if (loading || isLoading) {
    return (
      <div className="space-y-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="size-14 rounded-lg animate-pulse bg-secondary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded animate-pulse bg-secondary" />
              <div className="h-3 w-2/3 rounded animate-pulse bg-secondary" />
            </div>
            <div className="h-8 w-20 rounded-full animate-pulse bg-secondary shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="border border-border rounded-2xl p-8 text-center">
        <p className="text-muted-foreground mb-4">Sign in to see your order history.</p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 bg-coal text-bone eyebrow px-5 py-3 hover:bg-brass hover:text-coal transition"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="border border-border rounded-2xl p-12 text-center">
        <Package className="size-10 mx-auto mb-4 text-muted-foreground" strokeWidth={1.2} />
        <p className="font-display italic text-2xl">No orders yet.</p>
        <p className="text-muted-foreground mt-2">When you place an order, it'll appear here.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 mt-6 bg-coal text-bone eyebrow px-5 py-3 hover:bg-brass hover:text-coal transition"
        >
          Browse the edit →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow text-muted-foreground">§ Your history</p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-1">
          Orders<span className="text-brass">.</span>
        </h2>
      </div>
      {data.map((o: any) => (
        <div
          key={o.id}
          className="flex items-center gap-4 bg-card border border-border rounded-2xl p-5"
        >
          <div className="size-12 rounded-xl bg-primary-soft grid place-items-center shrink-0">
            <Package className="size-5 text-primary-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-semibold">{o.order_number}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tone[o.status] ?? ""}`}
              >
                {o.status}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 break-words">
              {o.created_at ? `${fmtDatePK(o.created_at)} · ${fmtTimePK(o.created_at)}` : "—"} ·{" "}
              {o.city || "—"}
            </div>
          </div>
          <span className="font-display font-bold text-primary-dark shrink-0">
            Rs {Number(o.total).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
