import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Dumbbell,
  Gamepad2,
  Home,
  LayoutGrid,
  Monitor,
  ShoppingBag,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listCategories } from "@/lib/shop.functions";
import { motion, type Variants } from "framer-motion";

const FALLBACK_CATS = [
  { slug: "electronics", name: "Electronics", Icon: Monitor, image: "" },
  { slug: "fashion", name: "Fashion", Icon: ShoppingBag, image: "" },
  { slug: "home-kitchen", name: "Home & Kitchen", Icon: Home, image: "" },
  { slug: "beauty", name: "Beauty", Icon: Sparkles, image: "" },
  { slug: "sports", name: "Sports", Icon: Dumbbell, image: "" },
  { slug: "toys", name: "Toys", Icon: LayoutGrid, image: "" },
];

const CATEGORY_META: Record<string, { Icon: LucideIcon; blurb: string; tone: string; image: string }> = {
  electronics: {
    Icon: Monitor,
    blurb: "Smart tech, useful upgrades, and everyday essentials.",
    tone: "bg-[#26333b]",
    image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80",
  },
  fashion: {
    Icon: ShoppingBag,
    blurb: "Personal style, considered pieces, and daily wear.",
    tone: "bg-[#4b3938]",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80",
  },
  "home-kitchen": {
    Icon: Home,
    blurb: "Small improvements for a better-looking home.",
    tone: "bg-[#3e4940]",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  },
  beauty: {
    Icon: Sparkles,
    blurb: "Care rituals, beauty tools, and feel-good finds.",
    tone: "bg-[#55424a]",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80",
  },
  sports: {
    Icon: Dumbbell,
    blurb: "Move better with gear for active everyday living.",
    tone: "bg-[#29413e]",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
  },
  toys: {
    Icon: Gamepad2,
    blurb: "Playful picks for curious minds and big imagination.",
    tone: "bg-[#544333]",
    image: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&q=80",
  },
};

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  image_url: string | null;
  image: string;
  Icon: LucideIcon;
  blurb: string;
  tone: string;
};

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: index * 0.07,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function toCategoryItem(
  category: typeof FALLBACK_CATS[number] | {
    id: string;
    slug: string;
    name: string;
    productCount: number;
    image_url: string | null;
    description: string | null;
  },
  index: number,
): CategoryItem {
  const meta = CATEGORY_META[category.slug];

  return {
    id: "id" in category ? category.id : String(index),
    slug: category.slug,
    name: category.name,
    productCount: "productCount" in category ? category.productCount ?? 0 : 0,
    image_url: "image_url" in category ? category.image_url : null,
    image: meta?.image ?? "",
    Icon: meta?.Icon ?? Smartphone,
    blurb: ("description" in category && category.description) || meta?.blurb || "A considered selection from Kifayat.",
    tone: meta?.tone ?? "bg-coal",
  };
}

function FallbackArtwork({ category, compact = false }: { category: CategoryItem; compact?: boolean }) {
  return (
    <div className={`absolute inset-0 -z-10 overflow-hidden ${category.tone}`} aria-hidden>
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(120deg,transparent_0%,transparent_48%,rgba(210,164,99,0.35)_48.2%,rgba(210,164,99,0.35)_49%,transparent_49.2%),linear-gradient(30deg,transparent_0%,transparent_70%,rgba(241,233,215,0.16)_70.2%,rgba(241,233,215,0.16)_70.7%,transparent_70.9%)] [background-size:38px_38px,76px_76px]" />
      <div className={`absolute -right-8 -top-10 border border-brass/35 ${compact ? "size-40" : "size-64"} rounded-full`} />
      <div className={`absolute -right-3 -top-5 border border-bone/15 ${compact ? "size-28" : "size-44"} rounded-full`} />
      <category.Icon
        className={`absolute text-brass/55 ${compact ? "right-8 top-8 size-14" : "right-10 top-10 size-24"}`}
        strokeWidth={0.8}
      />
    </div>
  );
}

function CountLabel({ category, dark = true }: { category: CategoryItem; dark?: boolean }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${dark ? "text-bone/65" : "text-coal/55"}`}>
      {category.productCount > 0
        ? `${category.productCount.toLocaleString()} products`
        : "Browse collection"}
    </span>
  );
}

function AtlasLink({
  category,
  index,
  variant,
}: {
  category: CategoryItem;
  index: number;
  variant: "lead" | "side" | "trail";
}) {
  const isLead = variant === "lead";
  const hasImage = Boolean(category.image_url || category.image);

  return (
    <motion.div
      custom={index}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-36px" }}
      className="min-w-0"
    >
      <Link
        to="/category/$slug"
        params={{ slug: category.slug }}
        className={`group relative isolate flex h-full overflow-hidden border border-coal/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-bone ${
          isLead
            ? "min-h-[390px] flex-col justify-between bg-coal p-5 text-bone sm:min-h-[440px] sm:p-7 lg:min-h-[532px]"
            : variant === "side"
              ? "min-h-[210px] flex-col justify-between bg-coal p-5 text-bone sm:min-h-[238px]"
              : "min-h-[172px] flex-col justify-between bg-paper p-4 text-coal sm:min-h-[186px] sm:p-5"
        }`}
      >
        {hasImage ? (
          <img
            src={category.image_url || category.image}
            alt=""
            loading="lazy"
            className={`absolute inset-0 -z-10 size-full object-cover transition duration-700 ease-out [filter:saturate(0.72)_contrast(1.04)] ${
              isLead ? "opacity-60 group-hover:scale-[1.045] group-hover:opacity-70" : "opacity-30 group-hover:scale-[1.06] group-hover:opacity-45"
            }`}
          />
        ) : (
          <FallbackArtwork category={category} compact={!isLead} />
        )}

        {isLead || variant === "side" ? (
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-coal via-coal/35 to-transparent" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-paper via-paper/95 to-paper/65" />
        )}

        <div className="flex items-start justify-between gap-3">
          <span className={`font-mono text-[10px] tracking-[0.2em] ${isLead || variant === "side" ? "text-bone/65" : "text-coal/45"}`}>
            {String(index + 1).padStart(2, "0")} / 06
          </span>
          <span className={`transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${isLead || variant === "side" ? "text-brass" : "text-brass-deep"}`}>
            <ArrowUpRight className="size-5" strokeWidth={1.2} />
          </span>
        </div>

        <div className="mt-auto max-w-[31rem]">
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-px w-7 transition-[width] duration-300 group-hover:w-11 ${isLead || variant === "side" ? "bg-brass" : "bg-brass-deep"}`} />
            <CountLabel category={category} dark={isLead || variant === "side"} />
          </div>
          <h3 className={`font-display italic leading-[0.95] transition-transform duration-300 group-hover:translate-x-1 ${
            isLead ? "text-4xl text-bone sm:text-6xl lg:text-7xl" : variant === "side" ? "text-3xl text-bone sm:text-4xl" : "text-2xl text-coal sm:text-3xl"
          }`}>
            {category.name}
          </h3>
          <p className={`mt-2 max-w-[32ch] text-xs leading-relaxed transition-colors duration-300 sm:text-sm ${
            isLead || variant === "side" ? "text-bone/72 group-hover:text-bone/90" : "text-coal/62 group-hover:text-coal/85"
          }`}>
            {category.blurb}
          </p>
          <span className={`mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] ${
            isLead || variant === "side" ? "text-brass group-hover:text-bone" : "text-brass-deep group-hover:text-coal"
          }`}>
            Explore
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.3} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function Categories() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });

  const source = isLoading || categories.length === 0 ? FALLBACK_CATS : categories;
  const items = source.map(toCategoryItem);
  const lead = items[0];
  const sideItems = items.slice(1, 3);
  const trailItems = items.slice(3);

  return (
    <section className="overflow-hidden bg-bone py-14 md:py-20 lg:py-24" aria-busy={isLoading}>
      <div className="mx-auto max-w-[1600px] px-4 sm:px-5 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5 md:mb-10">
          <div className="max-w-2xl">
            <p className="eyebrow mb-2 text-xs text-brass-deep md:text-sm">The atlas · 01</p>
            <h2 className="font-display text-4xl leading-[0.95] sm:text-5xl lg:text-6xl">
              Start with what matters.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-coal/62 sm:text-base">
              Useful things, arranged by instinct. Take the main road or follow a smaller find.
            </p>
          </div>
          <Link
            to="/products"
            className="group inline-flex items-center gap-2 border-b border-coal/30 pb-1.5 text-sm font-semibold text-coal transition-colors duration-200 hover:border-brass hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-4 focus-visible:ring-offset-bone"
          >
            Browse all products
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
          </Link>
        </div>

        {lead && (
          <div className="grid grid-cols-1 gap-2.5 md:gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7 lg:row-span-2">
              <AtlasLink category={lead} index={0} variant="lead" />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:gap-3">
              {sideItems.map((category, index) => (
                <AtlasLink key={category.slug} category={category} index={index + 1} variant="side" />
              ))}
            </div>

            {trailItems.length > 0 && (
              <div className="mt-1 grid grid-cols-2 gap-2.5 border-t border-coal/15 pt-3 sm:grid-cols-3 lg:col-span-12 lg:mt-0 lg:gap-3">
                {trailItems.map((category, index) => (
                  <AtlasLink key={category.slug} category={category} index={index + 3} variant="trail" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}