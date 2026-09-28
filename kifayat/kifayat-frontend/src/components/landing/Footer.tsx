import { Link } from "@tanstack/react-router";
import { Camera as Instagram, MessageCircle as Facebook, Music2, ArrowUpRight, Headphones, ShieldCheck, Truck, Banknote } from "lucide-react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  PHONE_DISPLAY, PHONE_TEL, CONTACT_EMAIL, CONTACT_HOURS, CONTACT_ADDRESS, whatsappHref,
} from "@/lib/contact";

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const sp = useSpring(scrollYProgress, { stiffness: 70, damping: 24, mass: 0.25 });
  const wordX = useTransform(sp, [0, 1], ["12%", "-12%"]);
  const [email, setEmail] = useState("");
  const t = useT();

  return (
    <footer ref={ref} className="bg-coal text-bone min-h-screen flex flex-col relative overflow-hidden">
      <div className="max-w-[1600px] w-full mx-auto px-5 lg:px-10 pt-20 lg:pt-32 pb-10 flex-1 flex flex-col">
        {/* Top â€” newsletter + meta */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 pb-16 lg:pb-24 border-b border-bone/10">
          <div className="lg:col-span-7">
            <p className="eyebrow text-bone/40 mb-6">{t("footer.letterEyebrow")}</p>
            <h2 className="font-display italic text-5xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight max-w-xl">
              {t("footer.letterTitle1")}<br />{t("footer.letterTitle2")}<span className="text-brass">.</span>
            </h2>
            <p className="mt-6 text-bone/60 max-w-md leading-relaxed">
              {t("footer.tagline")}
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); }}
              className="mt-10 flex max-w-xl border-b border-bone/30 focus-within:border-brass transition"
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@email.com"
                className="flex-1 bg-transparent py-4 outline-none text-bone placeholder:text-bone/30"
              />
              <button type="submit" className="eyebrow text-brass hover:text-bone transition flex items-center gap-2 px-2">
                {t("footer.subscribe")} <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-10">
            <div>
              <h3 className="eyebrow text-bone/40 mb-5">{t("footer.browse")}</h3>
              <ul className="space-y-3.5 font-display italic text-base">
                <li><Link to="/products" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.allItems")}</Link></li>
                <li><Link to="/category/$slug" params={{ slug: "electronics" }} className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.electronics")}</Link></li>
                <li><Link to="/category/$slug" params={{ slug: "fashion" }} className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.fashion")}</Link></li>
                <li><Link to="/category/$slug" params={{ slug: "home-kitchen" }} className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.home")}</Link></li>
                <li><Link to="/category/$slug" params={{ slug: "beauty" }} className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.beauty")}</Link></li>
                <li><Link to="/blog" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.stories")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="eyebrow text-bone/40 mb-5">{t("footer.service")}</h3>
              <ul className="space-y-3.5 font-display italic text-base">
                <li><Link to="/shipping-policy" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.shipping")}</Link></li>
                <li><Link to="/return-policy" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.returns")}</Link></li>
                <li><Link to="/report-defective" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.reportDefective")}</Link></li>
                <li><Link to="/account/orders" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.orders")}</Link></li>
                <li><Link to="/contact" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.contact")}</Link></li>
                <li><Link to="/faq" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.faq")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="eyebrow text-bone/40 mb-5">{t("footer.house")}</h3>
              <ul className="space-y-3.5 font-display italic text-base">
                <li><Link to="/about" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.story")}</Link></li>
                <li><Link to="/privacy" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.privacy")}</Link></li>
                <li><Link to="/terms" className="link-draw text-bone/70 hover:text-brass transition-colors">{t("footer.terms")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="eyebrow text-bone/40 mb-5">{t("footer.reach")}</h3>
              <ul className="space-y-3.5 font-display italic text-base">
                <li>
                  <a href={`tel:${PHONE_TEL}`} className="link-draw text-bone/70 hover:text-brass transition-colors">
                    {PHONE_DISPLAY}
                  </a>
                </li>
                <li>
                  <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="link-draw text-bone/70 hover:text-brass transition-colors">
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="link-draw text-bone/70 hover:text-brass transition-colors">
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li className="text-sm leading-relaxed text-bone/60">{CONTACT_HOURS}</li>
                <li className="text-sm leading-relaxed text-bone/60">{CONTACT_ADDRESS}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Middle â€” dispatch + socials */}
        <div className="py-12 grid sm:grid-cols-2 gap-10 border-b border-bone/10">
          <div>
            <p className="eyebrow text-bone/40 mb-3">{t("footer.dispatch")}</p>
            <p className="text-bone/85 leading-relaxed">
              {t("footer.dispatchBody")}
            </p>
          </div>
          <div>
            <p className="eyebrow text-bone/40 mb-3">{t("footer.elsewhere")}</p>
            <div className="flex gap-3">
              {[
                { Icon: Instagram, label: "Instagram", href: "https://www.instagram.com/kifayat.stores" },
                { Icon: Facebook, label: "Facebook", href: "https://www.facebook.com/profile.php?id=61592300213785" },
                { Icon: Music2, label: "TikTok", href: "https://www.tiktok.com/@kifayat2482" },
              ].map(({ Icon, label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="size-10 border border-bone/15 grid place-items-center hover:bg-brass hover:text-coal hover:border-brass transition">
                  <Icon className="size-4" strokeWidth={1.4} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="py-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-bone/10">
          {[
            { Icon: Truck, title: t("footer.deliveryExplained"), body: t("footer.dispatchBody"), to: "/shipping-policy" },
            { Icon: ShieldCheck, title: t("footer.payYourWay"), body: t("footer.codBody"), to: "/faq" },
            { Icon: Headphones, title: t("footer.needAHand"), body: t("footer.helpBody"), to: "/contact" },
          ].map(({ Icon, title, body, to }) => (
            <Link key={title} to={to} className="group border border-bone/10 p-4 hover:border-brass/60 transition-colors">
              <Icon className="size-4 text-brass mb-4" strokeWidth={1.4} aria-hidden="true" />
              <p className="eyebrow text-bone/75 text-[10px]">{title}</p>
              <p className="mt-2 text-sm text-bone/80 leading-relaxed group-hover:text-bone/75 transition-colors">{body}</p>
            </Link>
          ))}
        </div>

        {/* Kinetic giant wordmark */}
        <div className="flex-1 grid place-items-center py-16 lg:py-24 relative overflow-hidden">
          <motion.p
            style={reduce ? undefined : { x: wordX }}
            className="font-display italic text-[22vw] leading-[0.82] tracking-tight text-bone whitespace-nowrap will-change-transform"
          >
            Kifayat<span className="text-brass">.</span>
          </motion.p>
          <p className="absolute bottom-4 inset-x-0 text-center eyebrow text-bone/40">
            {t("footer.madeWith")}
          </p>
        </div>

        {/* â”€â”€ COD-only promise strip â”€â”€ */}
        <div className="py-6 border-t border-bone/10 flex flex-wrap items-center justify-center gap-2 eyebrow text-[11px] text-brass">
          <Banknote className="size-3.5" strokeWidth={1.5} />
          {t("footer.codOnly")}
        </div>

        {/* Bottom â€” SEO summary + legal */}
        <div className="pt-8 border-t border-bone/10">
          <p className="max-w-3xl mx-auto text-center text-[13px] leading-relaxed text-bone/40">
            Kifayat is Pakistan's online shopping destination for quality fashion, home goods, electronics and beauty â€” all at honest prices. With Kifayat online shopping, you can browse a curated catalog and buy online in Pakistan with fast, flat-fee delivery to every city, town and district nationwide. Cash on delivery and easy returns make Kifayat the trusted way to shop from home, all over Pakistan.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-between items-center eyebrow text-bone/40">
            <span>Â© 2026 Kifayat Co.</span>
            <a href="#top" className="link-draw inline-flex items-center gap-2 hover:text-brass transition">
              {t("footer.backToTop")} <ArrowUpRight className="size-3" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
