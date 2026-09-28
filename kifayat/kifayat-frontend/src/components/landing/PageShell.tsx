import { motion } from "framer-motion";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { MobileNav } from "@/components/landing/MobileNav";
import { SideDrawer } from "@/components/landing/SideDrawer";
import { BlendCursor } from "@/components/landing/BlendCursor";
import { useDrawerOpen } from "@/lib/ui-store";
import { whatsappHref } from "@/lib/contact";
import { WhatsAppIcon } from "@/components/trust/WhatsAppIcon";
import "@/styles/storefront-responsive.css";

/** Floating WhatsApp button — the #1 contact/trust channel in Pakistan.
 *  Sits above the MobileNav bar on small screens, bottom-right on larger. */
function FloatingWhatsApp() {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      title="Chat on WhatsApp"
      className="store-whatsapp fixed right-4 bottom-20 md:bottom-6 md:right-6 z-50 size-14 rounded-full bg-[#25D366] text-white grid place-items-center shadow-lg shadow-black/25 hover:scale-105 active:scale-95 transition-transform"
    >
      <WhatsAppIcon className="size-7" />
      <span
        className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-brass border-2 border-bone animate-pulse"
        aria-hidden="true"
      />
    </a>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  const open = useDrawerOpen();

  return (
    <div className="storefront-shell min-h-screen bg-background flex flex-col overflow-x-clip">
      <SideDrawer />
      <BlendCursor />
      <motion.div
        animate={{ x: open ? "min(420px, 70vw)" : 0, scale: open ? 0.985 : 1 }}
        transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
        className="flex flex-col flex-1 will-change-transform origin-left"
      >
        <Header />
        <main className="storefront-main flex-1 pb-20 md:pb-0">{children}</main>
        <Footer />
      </motion.div>
      <MobileNav />
      <FloatingWhatsApp />
    </div>
  );
}

export function PageHeader({ title, subtitle, breadcrumbs }: { title: string; subtitle?: string; breadcrumbs?: { label: string; to?: string }[] }) {
  return (
    <section className="bg-secondary/40 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        {breadcrumbs && (
          <nav className="text-xs text-muted-foreground mb-3 flex gap-1.5 flex-wrap">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {b.to ? <a href={b.to} className="hover:text-primary">{b.label}</a> : <span>{b.label}</span>}
                {i < breadcrumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-3xl lg:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground max-w-2xl">{subtitle}</p>}
      </div>
    </section>
  );
}
