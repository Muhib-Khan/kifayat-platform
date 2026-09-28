import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Monitor, ShoppingBag, Home, Sparkles, Dumbbell, LayoutGrid, Smartphone, Gamepad2, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listCategories } from "@/lib/shop.functions";
import { motion, type Variants } from "framer-motion";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const FALLBACK_CATS = [
  { slug: "electronics", name: "Electronics", Icon: Monitor },
  { slug: "fashion", name: "Fashion", Icon: ShoppingBag },
  { slug: "home-kitchen", name: "Home & Kitchen", Icon: Home },
  { slug: "beauty", name: "Beauty", Icon: Sparkles },
  { slug: "sports", name: "Sports", Icon: Dumbbell },
  { slug: "toys", name: "Toys", Icon: LayoutGrid },
];

const CATEGORY_META: Record<string, { Icon: LucideIcon; blurb: string; accent: string }> = {
  electronics: { Icon: Monitor, blurb: "Smart tech, useful upgrades, and everyday essentials.", accent: "from-[#26313a] via-[#344653] to-[#a57946]" },
  fashion: { Icon: ShoppingBag, blurb: "Personal style, considered pieces, and daily wear.", accent: "from-[#3f2f31] via-[#6c4d4d] to-[#c08b66]" },
  "home-kitchen": { Icon: Home, blurb: "Small improvements for a better-looking home.", accent: "from-[#384239] via-[#64705a] to-[#baa170]" },
  beauty: { Icon: Sparkles, blurb: "Care rituals, beauty tools, and feel-good finds.", accent: "from-[#493a43] via-[#866875] to-[#c7a177]" },
  sports: { Icon: Dumbbell, blurb: "Move better with gear for active everyday living.", accent: "from-[#283d3d] via-[#3d6a62] to-[#b08f54]" },
  toys: { Icon: Gamepad2, blurb: "Playful picks for curious minds and big imagination.", accent: "from-[#40362c] via-[#80614a] to-[#c2a15f]" },
};

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  Icon: LucideIcon;
  blurb: string;
  accent: string;
};

export function Categories() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });

  const items: CategoryItem[] = isLoading
    ? FALLBACK_CATS.map((c, i) => ({
        id: String(i), slug: c.slug, name: c.name, productCount: 0,
        description: null, image_url: null, sort_order: i, Icon: c.Icon,
        blurb: CATEGORY_META[c.slug]?.blurb || "Explore a considered selection from Kifayat.",
        accent: CATEGORY_META[c.slug]?.accent || "from-coal to-coal/70",
      }))
    : (categories.length > 0
      ? categories.map((c, i) => ({
          id: c.id || String(i), slug: c.slug!, name: c.name, productCount: c.productCount ?? 0,
          description: c.description || null, image_url: c.image_url || null, sort_order: i,
          Icon: CATEGORY_META[c.slug!]?.Icon || Smartphone,
          blurb: c.description || CATEGORY_META[c.slug!]?.blurb || "Explore a considered selection from Kifayat.",
          accent: CATEGORY_META[c.slug!]?.accent || "from-coal to-coal/70",
        }))
      : FALLBACK_CATS.map((c, i) => ({
          id: String(i), slug: c.slug, name: c.name, productCount: 0,
          description: null, image_url: null, sort_order: i, Icon: c.Icon,
          blurb: CATEGORY_META[c.slug]?.blurb || "Explore a considered selection from Kifayat.",
          accent: CATEGORY_META[c.slug]?.accent || "from-coal to-coal/70",
        })));

  return (
    <section className="bg-bone py-16 md:py-20 lg:py-28">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5 mb-8 md:mb-10">
          <div>
            <p className="eyebrow text-brass-deep mb-2 text-xs md:text-sm">The Curation · 01</p>
            <h2 className="font-display italic text-4xl sm:text-5xl lg:text-6xl">Find your next favorite.</h2>
            <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-coal/60">
              Six useful worlds, carefully arranged. Start with what you need or browse until something catches your eye.
            </p>
          </div>
          <Link to="/products" className="inline-flex items-center gap-2 border-b border-coal/30 pb-1.5 text-sm font-semibold text-coal hover:border-brass hover:text-brass transition-colors duration-200 group">
            Browse all products
            <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {items.map((c, i) => (
            <motion.div
              key={c.slug}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
            >
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`group relative isolate flex min-h-[245px] flex-col justify-between overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${c.accent} p-5 sm:p-6 text-bone shadow-[0_12px_35px_rgba(25,25,25,0.10)] transition-transform duration-300 hover:-translate-y-1`}
              >
                {c.image_url && (
                  <img
                    src={c.image_url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-10 size-full object-cover opacity-25 mix-blend-screen transition duration-500 group-hover:scale-105 group-hover:opacity-35"
                  />
                )}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-coal/65 via-transparent to-white/5" />
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-bone/75">
                    <span className="grid size-8 place-items-center rounded-full border border-bone/25 bg-coal/10">
                      <c.Icon className="size-4" strokeWidth={1.5} />
                    </span>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-full border border-bone/25 bg-coal/15 px-3 py-1.5 text-xs font-semibold text-bone/85">
                    {c.productCount > 0 ? `${c.productCount.toLocaleString()}+ products` : "Explore collection"}
                  </span>
                </div>
                <div className="mt-auto max-w-[18rem]">
                  <h3 className="font-display italic text-3xl sm:text-4xl leading-none text-white transition-transform duration-300 group-hover:translate-x-1">
                    {c.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-bone/75">{c.blurb}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brass transition-colors group-hover:text-white">
                    View collection
                    <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" strokeWidth={1.5} />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}