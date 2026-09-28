import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  RotateCcw,
  Loader2,
  Package,
  Search,
  ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  adminGetDeletedProducts,
  adminRestoreProduct,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/deleted-products")({
  component: AdminDeletedProducts,
});

const fmtDate = (v: string) =>
  v
    ? new Date(v).toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function AdminDeletedProducts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deleted-products", search, page],
    queryFn: () => adminGetDeletedProducts({ search, page: String(page) }),
  });

  const restoreMut = useMutation({
    mutationFn: adminRestoreProduct,
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Product restored.");
      qc.invalidateQueries({ queryKey: ["admin-deleted-products"] });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to restore."),
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-muted-foreground tracking-wide">Admin</p>
        <h1 className="font-display italic text-3xl lg:text-4xl mt-1 font-bold tracking-tight text-foreground">
          Deleted Products<span className="text-brass">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Soft-deleted products are preserved here and can be restored.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search deleted products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brass transition"
        />
      </div>

      {/* Products */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-e1">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : !data?.products?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Package className="size-8 mx-auto mb-3 opacity-30" strokeWidth={1.2} />
            No deleted products.
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {data.products.map((p: any) => (
                <motion.div
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 p-4 sm:p-5 hover:bg-secondary/30 transition-colors"
                >
                  {/* Thumbnail */}
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl.split(",")[0].split("?")[0].trim()}
                      alt={p.name}
                      className="size-14 rounded-xl object-cover border border-border shrink-0 bg-secondary"
                    />
                  ) : (
                    <div className="size-14 rounded-xl bg-secondary border border-border grid place-items-center shrink-0">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground line-clamp-1">{p.name}</p>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.sku && <span className="font-mono">{p.sku}</span>}
                      {p.sku && p.category && <span> · </span>}
                      {p.category && <span>{p.category}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Deleted {fmtDate(p.deletedAt)} · Rs {Number(p.retailPrice ?? 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/products/$productId"
                      params={{ productId: p.slug || p._id }}
                      target="_blank"
                      className="size-8 flex items-center justify-center border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-all shadow-sm"
                    >
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                    </Link>
                    <button
                      onClick={() => restoreMut.mutate(p._id)}
                      disabled={restoreMut.isPending}
                      className="px-3 py-2 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {restoreMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                      Restore
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-t border-border">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`size-8 text-xs font-bold rounded-lg transition ${
                      p === page ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
