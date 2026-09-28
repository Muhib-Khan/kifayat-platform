import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { getHeroObjects, getProductById, listProducts } from "@/lib/shop.functions";
import type { UIProduct } from "@/lib/api";
import { resolveImage, responsiveImageSet, EMPTY_IMAGE } from "@/lib/product-image-map";
import { useT } from "@/lib/i18n";

const FEATURES = [
  { Icon: Truck,       titleKey: "trust.delivery", bodyKey: "hero.deliveryBody" },
  { Icon: ShieldCheck, titleKey: "trust.cod",       bodyKey: "hero.codBody" },
  { Icon: RotateCcw,   titleKey: "trust.returns",   bodyKey: "hero.returnsBody" },
  { Icon: Headphones,  titleKey: "hero.support",    bodyKey: "hero.supportBody" },
];

const MARQUEE_ITEMS = ["Electronics", "Â·", "Fashion", "Â·", "Home & Kitchen", "Â·", "Beauty", "Â·", "Sports", "Â·", "New Arrivals", "Â·"];

const MARQUEE_LINKS: Record<string, string> = {
  Electronics: "electronics",
  Fashion: "fashion",
  "Home & Kitchen": "home-kitchen",
  Beauty: "beauty",
  Sports: "sports",
};

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const t = useT();

  // Admin-picked "Objects Considered" diptych (from Product Hunting). Falls
  // back to the default curated searches until a left/right product is chosen.
  const { data: heroCfg, isLoading: loadingCfg } = useQuery({
    queryKey: ["hero", "objects"],
    queryFn: getHeroObjects,
    staleTime: 60_000,
  });

  const heroReady = !loadingCfg;

  const { data: leftProduct = null, isLoading: loadingLeft } = useQuery({
    queryKey: ["hero", "left", heroCfg?.left ?? "default"],
    queryFn: () =>
      heroCfg?.left
        ? getProductById(heroCfg.left)
        : listProducts({ search: "track suit trouser set", limit: 1 }).then((r) => r.products[0] ?? null),
    enabled: heroReady,
    staleTime: 60_000,
  });

  const { data: rightProduct = null, isLoading: loadingRight } = useQuery({
    queryKey: ["hero", "right", heroCfg?.right ?? "default"],
    queryFn: () =>
      heroCfg?.right
        ? getProductById(heroCfg.right)
        : listProducts({ search: "earbuds", limit: 1 }).then((r) => r.products[0] ?? null),
    enabled: heroReady,
    staleTime: 60_000,
  });

  const isLoading = loadingCfg || loadingLeft || loadingRight;

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sp = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.2 });

  const yL     = useTransform(sp, [0, 1], ["0%", "-16%"]);
  const yR     = useTransform(sp, [0, 1], ["0%", "-24%"]);
  const titleY = useTransform(sp, [0, 1], ["0%", "-10%"]);

  return (
    <section ref={ref} className="relative bg-bone text-coal overflow-hidden">

      {/* â”€â”€ TOP META BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-8 lg:pt-12 flex items-center justify-between eyebrow text-coal/80">
        <span className="flex items-center gap-3">
          <span className="h-px w-8 bg-coal/25 shrink-0" />
          Volume 03 Â· Autumn Edit
        </span>
        <span className="hidden sm:block">Ships nationwide</span>
        <span className="hidden md:flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-brass animate-pulse" />
          Live inventory
        </span>
      </div>

      {/* â”€â”€ MAIN DIPTYCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative max-w-[1600px] mx-auto px-5 lg:px-10 pt-4 lg:pt-10">

        {/* Vertical edition label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.6 }}
          className="hidden xl:block absolute left-10 bottom-32 eyebrow text-coal/65 text-[9px] tracking-[0.35em] select-none"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          S01 â€” E03 â€” PKR â€” COD
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-end min-h-[65dvh] lg:min-h-[88vh]">

          {/* LEFT IMAGE */}
          <motion.figure
            initial={reduce ? false : { opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block lg:col-span-4 aspect-[3/4.2] bg-paper overflow-hidden relative self-end img-bone-grade"
          >
            {leftProduct ? (
              <picture>
                <source media="(min-width: 1024px)"
                  srcSet={responsiveImageSet(resolveImage(leftProduct.image_url, leftProduct.slug)) || resolveImage(leftProduct.image_url, leftProduct.slug, 1500)}
                  sizes="(min-width: 1600px) 500px, 32vw" />
              <motion.img
                style={reduce ? undefined : { y: yL }}
                src={EMPTY_IMAGE}
                alt={leftProduct.name}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                width={1500}
                height={2100}
                className="size-full object-contain will-change-transform"
              />
              </picture>
            ) : (
              <div className={`size-full ${isLoading ? "animate-pulse bg-bone/50" : "bg-paper"}`} />
            )}
            {/* label */}
            <span className="absolute top-5 left-5 eyebrow text-bone bg-coal/80 px-2.5 py-1 text-[10px]">
              {leftProduct ? `01 / ${leftProduct.name}` : "01 / Object"}
            </span>
            {/* thin bottom rule */}
            <motion.span
              className="absolute bottom-0 left-0 h-0.5 bg-brass"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.figure>

          {/* CENTER â€” headline + CTA only */}
          <motion.div
            style={reduce ? undefined : { y: titleY }}
            className="lg:col-span-4 order-first lg:order-none flex flex-col items-center justify-end lg:pb-10 text-center will-change-transform relative z-10 gap-5 lg:gap-10"
          >
            {/* eyebrow */}
            <motion.p
              className="eyebrow text-coal/75 tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0 }}
            >
              {t("hero.badge")}
            </motion.p>

            {/* headline */}
            <h1 className="font-display italic leading-[0.86] tracking-tight text-[18vw] sm:text-[13vw] lg:text-[8.5vw] xl:text-[7.8vw]" dir="ltr">
              {(["Kifayat,", "online store."] as const).map((word, i) => (
                <span key={word} className="block overflow-hidden">
                  <motion.span
                    className={`inline-block ${i === 1 ? "text-brass-deep" : ""}`}
                    initial={{ y: "110%" }}
                    animate={{ y: "0%" }}
                    transition={{ duration: 0.4, delay: 0, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>

            {/* sub-line */}
            <motion.p
              className="text-coal/85 text-sm lg:text-[15px] leading-relaxed max-w-[22ch] mx-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.85 }}
            >
              {t("hero.subline")}
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col items-center gap-4 w-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1.05 }}
            >
              {/* Primary â€” brass sweep fill */}
              <Link
                to="/products"
                className="group relative inline-flex items-center justify-between gap-6 bg-coal text-bone w-full max-w-[280px] px-8 py-[15px] eyebrow overflow-hidden"
              >
                {/* brass fill slides in from left on hover */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-brass translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                />
                <span className="relative z-10 transition-colors duration-300 group-hover:text-coal tracking-widest">
                  {t("hero.cta")}
                </span>
                <ArrowRight
                  className="relative z-10 size-4 shrink-0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-coal"
                  strokeWidth={1.25}
                />
              </Link>

              {/* Secondary â€” minimal text link */}
              <Link
                to="/products"
                className="group inline-flex items-center gap-1.5 eyebrow text-coal/75 hover:text-coal transition-colors duration-200 text-[11px]"
              >
                {t("hero.secondary")}
                <ArrowUpRight
                  className="size-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200"
                  strokeWidth={1.5}
                />
              </Link>
            </motion.div>

            {/* mobile product row (replaces diptych image on small screens â€” prices above the fold) */}
            <div className="lg:hidden w-full grid grid-cols-2 gap-3">
              {([leftProduct, rightProduct].filter(Boolean) as UIProduct[]).map((p) => (
                <Link
                  key={p.id}
                  to="/products/$productId"
                  params={{ productId: p.slug }}
                  className="group bg-paper border border-coal/10 p-2.5 overflow-hidden relative img-bone-grade"
                >
                  <span className="relative block aspect-square bg-paper overflow-hidden mb-2.5">
                    <picture>
                      <source media="(max-width: 1023px)"
                        srcSet={responsiveImageSet(resolveImage(p.image_url, p.slug)) || resolveImage(p.image_url, p.slug, 900)}
                        sizes="(min-width: 640px) calc((100vw - 80px) / 2), calc((100vw - 80px) / 2)" />
                    <img
                      src={EMPTY_IMAGE}
                      alt={p.name}
                      fetchPriority="high"
                      loading="eager"
                      decoding="async"
                      width={900}
                      height={900}
                      className="size-full object-contain transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-[1.06]"
                    />
                    </picture>
                  </span>
                  <p className="eyebrow text-coal/70 text-[9px] truncate mb-1">{p.brand ?? "Kifayat"}</p>
                  <p className="text-[12px] font-medium leading-snug truncate mb-1.5">{p.name}</p>
                  <span className="inline-block bg-brass text-coal eyebrow px-2 py-1 text-[10px]">
                    Rs {Math.round(p.price).toLocaleString()}
                  </span>
                </Link>
              ))}
              {!leftProduct && !rightProduct && (
                <div className={`col-span-2 aspect-[16/9] ${isLoading ? "animate-pulse bg-bone/50" : "bg-paper"}`} />
              )}
            </div>
          </motion.div>

          {/* RIGHT IMAGE */}
          <motion.figure
            initial={reduce ? false : { opacity: 0, y: 70 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block lg:col-span-4 aspect-[3/4.6] bg-paper overflow-hidden relative self-start lg:-mt-8 img-bone-grade"
          >
            {rightProduct ? (
              <picture>
                <source media="(min-width: 1024px)"
                  srcSet={responsiveImageSet(resolveImage(rightProduct.image_url, rightProduct.slug)) || resolveImage(rightProduct.image_url, rightProduct.slug, 1500)}
                  sizes="(min-width: 1600px) 500px, 32vw" />
              <motion.img
                style={reduce ? undefined : { y: yR }}
                src={EMPTY_IMAGE}
                alt={rightProduct.name}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                width={1500}
                height={2300}
                className="size-full object-contain will-change-transform"
              />
              </picture>
            ) : (
              <div className={`size-full ${isLoading ? "animate-pulse bg-bone/50" : "bg-paper"}`} />
            )}
            <span className="absolute top-5 right-5 eyebrow text-bone bg-coal/80 px-2.5 py-1 text-[10px]">
              {rightProduct ? `02 / ${rightProduct.name}` : "02 / Pairing"}
            </span>
            <span className="absolute bottom-5 right-5 eyebrow bg-brass text-coal px-3 py-1.5 text-[10px]">
              {rightProduct ? `PKR ${Math.round(rightProduct.price).toLocaleString()}` : "Autumn NÂ° 03"}
            </span>
          </motion.figure>
        </div>

        {/* â”€â”€ FEATURES STRIP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 1.25 }}
          className="mt-10 lg:mt-14 grid grid-cols-2 lg:grid-cols-4 gap-px bg-coal/10 border border-coal/10"
        >
          {FEATURES.map(({ Icon, titleKey, bodyKey }) => (
            <div key={titleKey} className="bg-bone flex items-start gap-3.5 px-5 py-5 lg:px-6 lg:py-6 group">
              <Icon className="size-4 text-brass mt-0.5 shrink-0" strokeWidth={1.5} aria-hidden />
              <div>
                <p className="eyebrow text-[10px] sm:text-[11px] leading-tight">{t(titleKey)}</p>
                <p className="text-[11px] sm:text-xs text-coal/80 mt-1 leading-snug">{t(bodyKey)}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* â”€â”€ MARQUEE STRIP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-coal text-bone py-[18px] overflow-hidden">
        <div className="flex gap-12 whitespace-nowrap animate-marquee marquee-hero font-display italic text-3xl lg:text-4xl xl:text-5xl">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-12 shrink-0 pr-12">
              {MARQUEE_ITEMS.map((w, i) =>
                w === "Â·" ? (
                  <span key={i} className="text-brass text-xl self-center">Â·</span>
                ) : MARQUEE_LINKS[w] ? (
                  <Link key={i} to="/category/$slug" params={{ slug: MARQUEE_LINKS[w] }} className="hover:text-brass transition-colors duration-300">
                    {w}
                  </Link>
                ) : (
                  <Link key={i} to="/products" className="hover:text-brass transition-colors duration-300">
                    {t("marquee.new")}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}