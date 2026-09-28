import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShoppingBag, User, LogOut, ShieldCheck, X, Truck, RotateCcw, Phone,
  Monitor, Shirt, Home as HomeIcon, Sparkles, Dumbbell, Tag, LayoutGrid, Menu, Search, Store,

} from "lucide-react";
import { uiStore } from "@/lib/ui-store";
import { useAuth, signOut } from "@/lib/auth-store";
import { useCart, cartTotals, FLAT_DELIVERY_FEE, fetchDeliveryFee } from "@/lib/cart-store";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/contact";
import { useT } from "@/lib/i18n";
import { optImage } from "@/lib/product-image-map";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchSuggest } from "@/lib/search.functions";
import { listCategories } from "@/lib/shop.functions";
import { motion, AnimatePresence } from "framer-motion";

// â”€â”€â”€ Static fallback category strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FALLBACK_CATS = [
  { slug: "electronics",  label: "Electronics",   Icon: Monitor   },
  { slug: "fashion",      label: "Fashion",        Icon: Shirt     },
  { slug: "home-kitchen", label: "Home & Kitchen", Icon: HomeIcon  },
  { slug: "beauty",       label: "Beauty",         Icon: Sparkles  },
  { slug: "sports",       label: "Sports",         Icon: Dumbbell  },
  { slug: "toys",         label: "Toys",           Icon: LayoutGrid},
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  electronics: Monitor,
  fashion: Shirt,
  "home-kitchen": HomeIcon,
  beauty: Sparkles,
  sports: Dumbbell,
  toys: LayoutGrid,
};

// â”€â”€â”€ Inline search bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function HeaderSearch({ className = "relative flex-1 min-w-0 max-w-2xl" }: { className?: string }) {
  const navigate  = useNavigate();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["header-suggest", debouncedQ],
    queryFn: () => searchSuggest(debouncedQ),
    enabled: open && debouncedQ.trim().length >= 2,
    staleTime: 30_000,
  });

  const hasSuggestions =
    debouncedQ.length >= 2 && (data?.queries?.length || data?.products?.length);
  const hasQueries = !!data?.queries?.length;
  const showPanel = debouncedQ.length >= 2 && (isLoading || hasSuggestions);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate({ to: "/search", search: { q: term } as any });
    setQ(""); setOpen(false);
  }

  function go(term: string) {
    navigate({ to: "/search", search: { q: term } as any });
    setQ(""); setOpen(false);
  }

  return (
    <div ref={wrapRef} className={className}>
      <form onSubmit={submit} className="flex min-w-0">
        <div className="relative flex-1 min-w-0">
          <input
            type="search"
            aria-label={t("search.placeholder")}
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={t("search.placeholder")}
             className="w-full min-w-0 h-12 pl-3 sm:pl-5 pr-9 sm:pr-10 border-2 border-coal/20 bg-paper focus:border-coal outline-none text-sm sm:text-base transition-colors placeholder:text-coal/70"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => { setQ(""); setOpen(false); }}
               className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 p-2 text-coal/70 hover:text-coal transition">
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
        <button type="submit" aria-label={t("search.submit")}
            className="shrink-0 h-12 px-3 sm:px-6 bg-coal text-bone text-sm font-semibold tracking-wide hover:bg-brass hover:text-coal transition-colors duration-300">
           <Search className="size-4 sm:hidden" strokeWidth={1.5} />
           <span className="hidden sm:inline">{t("search.submit")}</span>
        </button>
      </form>

      <AnimatePresence>
        {open && showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full left-0 right-0 z-50 bg-bone border border-coal/15 shadow-xl mt-0.5 max-h-[min(420px,65vh)] overflow-y-auto"
          >
            <div className={`p-4 grid gap-5 ${hasQueries ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {isLoading ? (
                <div className="space-y-3" aria-hidden>
                  <div className="h-2.5 w-20 rounded bg-coal/10 animate-pulse" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-4 rounded bg-coal/10 animate-pulse w-3/4" />
                  ))}
                </div>
              ) : (
              <>
              {data?.queries && data.queries.length > 0 && (
                <div>
                  <p className="eyebrow text-coal/70 text-[10px] mb-2">{t("search.suggestions")}</p>
                  <ul className="space-y-0.5">
                    {data.queries.slice(0, 5).map((s) => (
                      <li key={s} className="min-w-0">
                        <button onClick={() => go(s)}
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-paper transition flex items-center gap-2">
                          <span className="text-brass text-xs shrink-0">â†’</span>
                          <span className="min-w-0 truncate">{s}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data?.products && data.products.length > 0 && (
                <div>
                  <p className="eyebrow text-coal/70 text-[10px] mb-2">{t("search.products")}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.products.slice(0, 4).map((p: any) => (
                      <li key={p.slug}>
                        <Link to="/products/$productId" params={{ productId: p.slug }}
                          onClick={() => { setQ(""); setOpen(false); }}
                          className="flex items-center gap-2.5 px-2 py-1.5 min-h-11 hover:bg-paper transition">
                          {p.image_url
                            ? <img src={optImage(p.image_url, 80)} alt="" width={40} height={40} className="size-10 object-cover bg-paper shrink-0" />
                            : <div className="size-10 bg-paper shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="eyebrow text-coal/70 text-[10px] truncate">
                              Rs {Number(p.price).toLocaleString()}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// â”€â”€â”€ Account dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AccountDropdown() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    function click(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    window.addEventListener("mousedown", click);
    return () => window.removeEventListener("mousedown", click);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account"
        className="flex flex-col items-center gap-0.5 p-2.5 -m-1 hover:text-brass transition-colors group">
        <User className="size-5" strokeWidth={1.2} />
        <span className="eyebrow text-[9px] hidden sm:block text-coal/60 group-hover:text-brass transition-colors">
          {user ? t("header.account") : t("header.signIn")}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 w-64 bg-bone border border-coal/15 shadow-xl z-50 py-2"
          >
            {user ? (
              <>
                <div className="px-4 py-3 border-b border-coal/10">
                  <p className="eyebrow text-muted-foreground text-[10px]">Signed in as</p>
                  <p className="font-display italic text-base truncate mt-0.5">{user.email}</p>
                </div>
                <Link to="/account/orders"   onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-paper transition">My orders</Link>
                <Link to="/account/wishlist" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-paper transition">Wishlist</Link>
                <Link to="/account/addresses" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-paper transition">Addresses</Link>
                <Link to="/account"          onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-paper transition">Account</Link>
                {user.role === "admin" && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-paper transition">
                    <ShieldCheck className="size-4" strokeWidth={1.4} /> Admin
                  </Link>
                )}
                {user.role === "seller" && (
                  <Link to="/seller/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-paper transition">
                    <Store className="size-4" strokeWidth={1.4} /> Seller dashboard
                  </Link>
                )}
                <button
                  onClick={async () => { setOpen(false); await signOut(); navigate({ to: "/" }); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-paper transition border-t border-coal/10 mt-1"
                >
                  <LogOut className="size-4" strokeWidth={1.4} /> Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-paper transition">Sign in</Link>
                <Link to="/auth" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-paper transition">Create account</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// â”€â”€â”€ Category strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CategoryStrip() {
  const { data: dbCats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: 30_000,
  });

  // Use DB categories if present, otherwise fall back to keyword-based defaults
  const cats = dbCats.length > 0
    ? dbCats.slice(0, 8).map((c) => ({
        slug: c.slug,
        label: c.name,
        Icon: ICON_MAP[c.slug] ?? LayoutGrid,
      }))
    : FALLBACK_CATS;

  return (
    <div className="bg-bone border-b border-coal/8">
         <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
          {cats.map(({ slug, label, Icon }) => (
            <Link
              key={slug}
              to="/category/$slug"
              params={{ slug }}
              preload="render"
               className="group flex items-center gap-1.5 px-3 py-4 min-h-14 text-xs sm:text-sm font-medium tracking-normal text-coal/80 hover:text-coal hover:bg-paper whitespace-nowrap transition-colors shrink-0 border-b-2 border-transparent hover:border-brass"
            >
              <Icon className="size-3.5 group-hover:text-brass transition-colors" strokeWidth={1.5} />
              {label}
            </Link>
          ))}
          <div className="w-px h-4 bg-coal/10 mx-1 shrink-0" />
          <Link
            to="/seller/$slug"
            params={{ slug: "faizs-store" }}
            preload="render"
             className="group flex items-center gap-1.5 px-3 py-4 min-h-14 text-xs sm:text-sm font-medium tracking-normal text-coal/80 hover:text-coal hover:bg-paper whitespace-nowrap transition-colors shrink-0 border-b-2 border-transparent hover:border-brass"
          >
            <Store className="size-3.5 group-hover:text-brass transition-colors" strokeWidth={1.5} />
             Faiza&apos;s Store
          </Link>
          <Link
            to="/products"
            preload="render"
             className="flex items-center gap-1.5 px-3 py-4 min-h-14 text-xs sm:text-sm font-semibold tracking-normal text-brass whitespace-nowrap transition-colors shrink-0 hover:opacity-75"
          >
            <Tag className="size-3.5" strokeWidth={1.5} />
            All Deals
          </Link>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function Header() {
  const items       = useCart();
  const { count }   = cartTotals(items);
  const { user }    = useAuth();
  const t           = useT();

  // â”€â”€ Admin-editable delivery fee (falls back to FLAT_DELIVERY_FEE) â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: deliveryFee = FLAT_DELIVERY_FEE } = useQuery({
    queryKey: ["deliveryFee"],
    queryFn: fetchDeliveryFee,
    staleTime: 5 * 60 * 1000,
  });

  // â”€â”€ Auto-hide on scroll down, reveal on scroll up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [hidden, setHidden]   = useState(false);
  const lastY   = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) {
          setHidden(false);                     // always visible near top
        } else if (y > lastY.current + 8) {
          setHidden(true);                      // scrolling down â†’ hide
        } else if (y < lastY.current - 8) {
          setHidden(false);                     // scrolling up â†’ reveal
        }
        lastY.current = y;
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className="sticky top-0 z-50 will-change-transform"
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* â”€â”€ Top banner â”€â”€ */}
      <div className="bg-coal text-bone">
         <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-10 flex items-center justify-between text-xs sm:text-sm font-medium tracking-normal">
          <span className="hidden sm:inline opacity-75">
            {t("banner.delivery", { fee: deliveryFee })}
          </span>
          <a href={`tel:${PHONE_TEL}`} className="sm:hidden opacity-75 hover:opacity-100 hover:text-brass transition">
            {PHONE_DISPLAY}
          </a>
          <div className="flex items-center gap-5 opacity-75">
            <a
              href={`tel:${PHONE_TEL}`}
              className="hidden sm:inline-flex items-center gap-1.5 hover:opacity-100 hover:text-brass transition"
              title="Call or WhatsApp"
            >
              <Phone className="size-3" strokeWidth={1.5} /> {PHONE_DISPLAY}
            </a>
            <span className="hidden sm:inline">{t("banner.cod")}</span>
            <Link to="/contact" className="hover:opacity-100 transition hover:text-brass">
              {t("header.help")}
            </Link>
          </div>
        </div>
      </div>

      {/* â”€â”€ Main nav â”€â”€ */}
      <div className="bg-bone/95 backdrop-blur-xl border-b border-coal/8 relative z-50">
         <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8 h-[4.5rem] lg:h-20 flex items-center gap-2 sm:gap-3 lg:gap-5">

          {/* Drawer toggle */}
          <button
            onClick={() => uiStore.toggleDrawer()}
            aria-label="Open menu"
             className="shrink-0 size-10 grid place-items-center p-1.5 hover:text-brass transition-colors text-coal/70 hover:bg-paper rounded-sm"
          >
            <Menu className="size-5" strokeWidth={1.2} />
          </button>

          {/* Logo */}
          <Link to="/" aria-label="Kifayat â€” home" className="shrink-0 font-display italic text-xl sm:text-2xl lg:text-3xl tracking-tight leading-none">
            Kifayat<span className="text-brass">.</span>
          </Link>

          {/* Search bar â€” desktop inline */}
          <HeaderSearch className="hidden lg:block relative flex-1 min-w-0 max-w-2xl" />

          {/* Right icons */}
          <div className="flex items-center gap-3 lg:gap-4 shrink-0 ml-auto lg:ml-0">
            <AccountDropdown />
            <Link to="/cart" aria-label="Cart" data-cart-icon
              className="flex flex-col items-center gap-0.5 p-2.5 -m-1 relative hover:text-brass transition-colors group">
              <ShoppingBag className="size-5" strokeWidth={1.2} />
              <span className="eyebrow text-[9px] hidden sm:block text-coal/60 group-hover:text-brass transition-colors">
                {t("header.cart")}
              </span>
              {count > 0 && (
                <span className="absolute -top-0.5 left-5 size-4 rounded-full bg-brass text-coal text-[9px] font-bold grid place-items-center">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* â”€â”€ Mobile search row (full width below nav) â”€â”€ */}
      <div className="lg:hidden bg-bone/95 backdrop-blur-xl border-b border-coal/8 px-3 sm:px-4 pb-3">
        <HeaderSearch className="w-full" />
      </div>

      {/* â”€â”€ Category strip â”€â”€ */}
      <CategoryStrip />
      <div className="hidden lg:block bg-paper border-b border-coal/8">
         <div className="max-w-[1600px] mx-auto px-8 h-11 flex items-center justify-center gap-8 text-xs font-medium tracking-normal text-coal/85">
          <span className="inline-flex items-center gap-1.5"><Truck className="size-3 text-brass" strokeWidth={1.5} /> {t("trust.delivery")}</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3 text-brass" strokeWidth={1.5} /> {t("trust.cod")}</span>
          <span className="inline-flex items-center gap-1.5"><RotateCcw className="size-3 text-brass" strokeWidth={1.5} /> {t("trust.returns")}</span>
        </div>
      </div>
    </motion.header>
  );
}
