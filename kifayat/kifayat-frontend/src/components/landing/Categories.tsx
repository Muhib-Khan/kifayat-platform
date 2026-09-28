import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Monitor, ShoppingBag, Home, Sparkles, Dumbbell, LayoutGrid } from "lucide-react";
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

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  Icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
      }))
    : (categories.length > 0
      ? categories.map((c, i) => ({
          id: c.id || String(i), slug: c.slug!, name: c.name, productCount: c.productCount ?? 0,
          description: null, image_url: c.image_url || null, sort_order: i,
        }))
      : FALLBACK_CATS.map((c, i) => ({
          id: String(i), slug: c.slug, name: c.name, productCount: 0,
          description: null, image_url: null, sort_order: i, Icon: c.Icon,
        })));

  return (
    <section className="bg-bone py-16 md:py-20 lg:py-32">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-10">
        <div className="flex items-end justify-between mb-8 md:mb-10 lg:mb-14">
          <div>
            <p className="eyebrow text-coal/80 mb-2 md:mb-3 text-xs md:text-sm">The Curation</p>
            <h2 className="font-display italic text-4xl sm:text-5xl lg:text-7xl">By Category</h2>
          </div>
          <Link to="/products" className="hidden sm:inline-flex items-center gap-2 eyebrow text-coal/80 hover:text-coal transition-colors duration-200 group text-xs md:text-sm">
            All categories
            <ArrowUpRight className="size-3 md:size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="border-y border-coal/10 divide-y divide-coal/10">
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
                className="group flex items-center justify-between gap-4 py-5 md:py-6 lg:py-7"
              >
                <div className="flex items-baseline gap-4 md:gap-6 lg:gap-10 min-w-0">
                  <span className="eyebrow text-coal/70 text-xs md:text-sm shrink-0">
                    NÂ° {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display italic text-3xl sm:text-4xl md:text-5xl lg:text-6xl group-hover:text-brass transition-colors duration-300 truncate">
                    {c.name}
                  </h3>
                </div>
                <div className="flex items-center gap-3 md:gap-4 shrink-0">
                  {c.productCount > 0 && (
                    <p className="eyebrow text-coal/70 text-xs md:text-sm whitespace-nowrap">
                      {c.productCount.toLocaleString()}+
                    </p>
                  )}
                  <span className="size-8 md:size-10 bg-brass rounded-full grid place-items-center opacity-0 group-hover:opacity-100 -translate-x-3 group-hover:translate-x-0 transition-all duration-400">
                    <ArrowUpRight className="size-3 md:size-4 text-coal" strokeWidth={1.5} />
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