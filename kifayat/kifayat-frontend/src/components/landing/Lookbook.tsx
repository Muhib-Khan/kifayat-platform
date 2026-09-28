import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Package } from "lucide-react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/shop.functions";
import { optImage } from "@/lib/product-image-map";

const SCENES = [
  { no: "01", title: "Desk, late evening.",  note: "The standout, paired with quiet light.",   search: "headphones earphones speaker audio" },
  { no: "02", title: "Wrist, mid-morning.",  note: "Worn â€” read at a glance.",               search: "watch band strap smartwatch" },
  { no: "03", title: "Hallway, Sunday.",     note: "Low-key, unhurried.",                     search: "decor art frame wall mirror" },
  { no: "04", title: "Vanity, first light.", note: "A small ritual.",                          search: "cream serum beauty skincare" },
] as const;

export function Lookbook() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const sp = useSpring(scrollYProgress, { stiffness: 60, damping: 24 });
  const yA = useTransform(sp, [0, 1], ["6%", "-6%"]);
  const yB = useTransform(sp, [0, 1], ["-4%", "4%"]);

  const queries = SCENES.map((s) =>
    useQuery({
      queryKey: ["lookbook", s.search],
      queryFn: () => listProducts({ search: s.search, limit: 10 }).then((r) => r.products),
    })
  );

  return (
    <section ref={ref} className="bg-paper py-20 lg:py-32 relative overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16 lg:mb-24">
          <div className="lg:col-span-8">
            <p className="eyebrow text-coal/80 mb-4">Â§ Lookbook Â· Volume 03</p>
            <h2 className="font-display italic text-5xl md:text-7xl lg:text-[8rem] leading-[0.88] tracking-tight">
              In <span className="text-brass-deep">situ</span>.<br />Around the house.
            </h2>
          </div>
          <p className="lg:col-span-4 text-coal/65 leading-relaxed max-w-md lg:text-lg">
            Four small scenes â€” the way these objects actually sit in a day. No stylists, no perfect light. Just where they belong.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {SCENES.map((s, i) => {
            const products = queries[i]?.data ?? [];
            const loading  = queries[i]?.isLoading ?? false;
            const product = products.find((p: any) => p.image_url) ?? products[0] ?? null;
            const imgSrc  = product?.image_url ?? null;
            const slug    = product?.slug ?? product?.id ?? null;
            const name    = product?.name ?? null;

            const isLarge  = i === 0 || i === 3;
            const colSpan  = isLarge ? "col-span-12 lg:col-span-8" : "col-span-12 lg:col-span-4";
            const offset   = i % 2 === 0 ? "lg:mt-0" : "lg:mt-16";
            const y        = i % 2 === 0 ? yA : yB;

            const inner = (
              <>
                <motion.div
                  style={reduce ? undefined : { y }}
                  className={`relative overflow-hidden bg-bone img-bone-grade ${isLarge ? "aspect-[16/10]" : "aspect-[3/4]"}`}
                >
                  {imgSrc ? (
                    <img
                      src={optImage(imgSrc, 1280)}
                      alt={name ?? s.title}
                      loading="lazy"
                      decoding="async"
                      width={1280}
                      height={800}
                      className="size-full object-cover img-breathe transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-[1.04]"
                    />
                  ) : loading ? (
                    <div className="size-full animate-pulse bg-bone/60" />
                  ) : (
                    <div className="size-full flex items-center justify-center bg-gradient-to-br from-coal/5 to-coal/10">
                      <Package className="size-12 text-coal/20" strokeWidth={1} />
                    </div>
                  )}
                  <span className="absolute top-4 left-4 eyebrow bg-bone/85 text-coal px-2 py-1 font-mono">NÂ° {s.no}</span>
                  <span className="absolute top-4 right-4 eyebrow text-bone bg-coal/70 backdrop-blur-sm px-2 py-1 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition">
                    View â†—
                  </span>
                </motion.div>
                <div className="mt-5 flex items-start justify-between gap-6">
                  <div>
                    <h3 className="font-display italic text-2xl lg:text-3xl leading-tight">{s.title}</h3>
                    <p className="text-coal/85 mt-2 text-sm">{name ? name : s.note}</p>
                  </div>
                  <ArrowUpRight className="size-5 text-coal/70 group-hover:text-brass group-hover:translate-x-1 group-hover:-translate-y-1 transition shrink-0" strokeWidth={1.3} />
                </div>
              </>
            );

            return (
              <motion.div
                key={s.no}
                initial={reduce ? false : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={`${colSpan} ${offset}`}
              >
                {slug ? (
                  <Link to="/products/$productId" params={{ productId: slug }} className="group block">
                    {inner}
                  </Link>
                ) : (
                  <div className="group block cursor-default">{inner}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
