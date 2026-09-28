import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, PackageCheck, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPublicProof } from "@/lib/shop.functions";

export function PressStrip() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-proof"],
    queryFn: listPublicProof,
    staleTime: 10 * 60 * 1000,
  });

  const reviews = data?.reviews ?? [];
  const orders = data?.orders ?? 0;
  const average = data?.average ?? 0;
  const totalReviews = data?.totalReviews ?? 0;

  // Only show a stat once real data exists for it — never fake numbers.
  const stats = ([
    orders > 0 && {
      n: `${orders.toLocaleString()}+`,
      l: "Orders delivered",
      Icon: PackageCheck,
    },
    average > 0 && {
      n: `${average}★`,
      l: "Average rating",
      Icon: Star,
    },
    totalReviews > 0 && {
      n: `${totalReviews.toLocaleString()}+`,
      l: "Verified reviews",
      Icon: BadgeCheck,
    },
    { n: "2–4", l: "Days to deliver · all of Pakistan", Icon: PackageCheck },
  ] as const).filter(
    (s): s is Exclude<typeof s, false | undefined> => Boolean(s),
  );

  return (
    <section className="bg-coal text-bone py-16 lg:py-24 border-y border-bone/10 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        <p className="eyebrow text-bone/80 mb-10 lg:mb-12">Proof, not press</p>

        {/* Live proof numbers — only genuinely real ones */}
        <div className="grid grid-cols-2 gap-px bg-bone/10 border border-bone/10 mb-12 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="bg-coal p-6 lg:p-8">
              <s.Icon className="size-4 text-brass mb-3" strokeWidth={1.5} />
              <p className="font-display italic text-3xl lg:text-4xl">{s.n}</p>
              <p className="eyebrow text-bone/40 mt-2 text-[11px]">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Real reviews with city */}
        <div className="border-t border-bone/10 pt-12">
          <div className="flex items-end justify-between mb-8">
            <p className="eyebrow text-bone/80">From verified buyers</p>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-bone/10 p-5 animate-pulse">
                  <div className="h-3 bg-bone/10 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-bone/10 rounded w-4/5" />
                  <div className="h-3 bg-bone/10 rounded w-3/5 mt-2" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-bone/60 text-sm leading-relaxed max-w-md">
              Orders are still arriving. Every parcel is tracked and updates are shared until it lands at your door.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {reviews.map((r) => (
                <figure key={r.id} className="border border-bone/10 bg-bone/5 p-5">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`size-3 ${i < r.rating ? "fill-brass text-brass" : "text-bone/65"}`} strokeWidth={1} />
                    ))}
                  </div>
                  <blockquote className="text-sm leading-relaxed text-bone/85">
                    &ldquo;{r.comment}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 eyebrow text-bone/80 text-[10px]">
                    {r.name}
                    {r.city && <> â€” bought it, delivered to {r.city}</>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 border border-bone/25 bg-bone/5 text-bone eyebrow px-5 py-2.5 text-xs hover:border-brass hover:text-brass transition-colors"
          >
            Shop the catalogue <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
          </Link>
          <span className="inline-flex items-center gap-2 eyebrow text-bone/40 text-xs">
            <PackageCheck className="size-3.5 text-brass" strokeWidth={1.5} /> Real order updates shared until the parcel arrives
          </span>
        </div>
      </div>
    </section>
  );
}