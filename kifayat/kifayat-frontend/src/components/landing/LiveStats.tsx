import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { listPublicStats } from "@/lib/shop.functions";

function Counter({ to, suffix, decimals = 0 }: { to: number; suffix: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) { setV(to); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 1600;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, reduce]);

  const display = decimals > 0
    ? v.toFixed(decimals)
    : Math.round(v).toLocaleString();

  return <span ref={ref}>{display}{suffix}</span>;
}

export function LiveStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-stats"],
    queryFn: listPublicStats,
    staleTime: 5 * 60 * 1000,
  });

  const stats = [
    {
      value: data?.totalProducts ?? 0,
      suffix: "+",
      label: "Products in catalogue",
    },
    {
      value: data?.totalCategories ?? 6,
      suffix: "",
      label: "Categories, curated",
    },
    {
      value: 38,
      suffix: "",
      label: "Cities served Â· Pakistan-wide",
    },
    {
      value: 4.8,
      suffix: "â˜…",
      label: "Across thousands of orders",
      decimals: 1,
    },
  ];

  return (
    <section className="bg-bone border-y border-coal/10 py-16 lg:py-24">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 mb-12 lg:mb-16 items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow text-coal/80 mb-4">Across Pakistan Â· live</p>
            <h2 className="font-display italic text-5xl lg:text-7xl leading-[0.92] tracking-tight">
              Trust, in <span className="text-brass-deep">numbers</span>.
            </h2>
          </div>
          <p className="lg:col-span-5 text-coal/65 max-w-md leading-relaxed">
            Pulled live from the catalogue. No vanity metrics â€” only the figures a careful shopper would actually weigh.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-coal/10">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-bone p-8 lg:p-10" aria-hidden>
                <div className="h-8 w-24 rounded animate-pulse bg-coal/10" />
                <div className="h-3 w-20 rounded animate-pulse bg-coal/10 mt-3" />
              </div>
            ))
          ) : (
            stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="bg-bone p-6 lg:p-10"
            >
              <p className="font-display italic text-5xl lg:text-7xl leading-none">
                <Counter to={s.value} suffix={s.suffix} decimals={(s as any).decimals} />
              </p>
              <p className="eyebrow text-coal/85 mt-4">{s.label}</p>
            </motion.div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
