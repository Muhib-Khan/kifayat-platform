import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

/** N lines of pulsing text */
function TextSkeleton({ lines = 3, className, lineClassName }: { lines?: number; className?: string; lineClassName?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3 w-full", lineClassName)} />
      ))}
    </div>
  );
}

/** Storefront product card placeholder (matches Products grid cards) */
function ProductCardSkeleton({ dark = false }: { dark?: boolean }) {
  const base = dark ? "bg-bone/10" : "bg-bone/50";
  return (
    <div className="space-y-3" aria-hidden>
      <div className={cn("aspect-square animate-pulse", base)} />
      <div className={cn("h-3 animate-pulse rounded", base, "w-3/4")} />
      <div className={cn("h-3 animate-pulse rounded", base, "w-1/2")} />
    </div>
  );
}

/** Storefront product grid placeholder */
function ProductGridSkeleton({
  count = 12,
  dark = false,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8",
}: { count?: number; dark?: boolean; columns?: string }) {
  return (
    <div className={cn("grid gap-x-4 gap-y-10 lg:gap-x-6 lg:gap-y-16", columns)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} dark={dark} />
      ))}
    </div>
  );
}

/** Admin panel with header bar + table-ish rows */
function PanelTableSkeleton({ rows = 8, cols = 4, header = true }: { rows?: number; cols?: number; header?: boolean }) {
  return (
    <div className="bg-card border border-border shadow-e1 rounded-2xl overflow-hidden" aria-hidden>
      {header && (
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-5 py-4 flex items-center gap-4">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-2/5 max-w-64 flex-1" : "w-16 sm:w-24")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple list of rows (avatar + lines) */
function ListSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="divide-y divide-border" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="py-4 flex items-center gap-4">
          {avatar && <Skeleton className="size-10 shrink-0 rounded-full" />}
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-1/3 max-w-56" />
            <Skeleton className="h-3 w-2/3 max-w-72" />
          </div>
          <Skeleton className="h-6 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Full-page centered spinner fallback → skeleton stack */
function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <PanelTableSkeleton rows={rows} />
    </div>
  );
}

export {
  Skeleton,
  TextSkeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  PanelTableSkeleton,
  ListSkeleton,
  PageSkeleton,
};
