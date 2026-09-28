import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { SEO } from "@/components/seo/SEO";
import { LocalBusinessSchema } from "@/components/seo/JsonLd";
import { WhatsAppIcon } from "@/components/trust/WhatsAppIcon";
import {
  PHONE_DISPLAY, PHONE_TEL, CONTACT_EMAIL, CONTACT_HOURS, CONTACT_ADDRESS, whatsappHref,
} from "@/lib/contact";

export const Route = createFileRoute("/contact")({
  component: Contact,
});

function Contact() {
  return (
    <PageShell>
      <SEO
        title="Contact Us — We Reply Within an Hour"
        description="Get in touch with the Kifayat team in Pakistan. We reply within an hour during business hours. Reach us by email, phone, or WhatsApp."
        path="/contact"
        keywords="contact Kifayat, online store support Pakistan, customer service Pakistan, WhatsApp shopping help"
      />
      <LocalBusinessSchema />

      <PageHeader
        title="Get in touch"
        subtitle="We usually reply within an hour during business hours."
        breadcrumbs={[{ label: "Home", to: "/" }, { label: "Contact" }]}
      />

      <section className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-[1fr_360px] gap-10">
        <form className="bg-card border border-border rounded-2xl p-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
          <div className="grid sm:grid-cols-2 gap-4">
            <label>
              <span className="block text-sm font-medium mb-1.5">Name</span>
              <input required className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
            </label>
            <label>
              <span className="block text-sm font-medium mb-1.5">Email</span>
              <input type="email" required className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Subject</span>
            <input className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Message</span>
            <textarea rows={5} required className="w-full px-3.5 py-2.5 rounded-md border border-border outline-none focus:border-primary text-sm resize-none" />
          </label>
          <button type="submit" className="w-full h-11 bg-foreground text-background rounded-md text-sm font-semibold hover:opacity-90 transition">
            Send message
          </button>
        </form>

        <div className="space-y-4">
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            <WhatsAppIcon className="size-4" /> Chat on WhatsApp
          </a>

          {[
            { Icon: Mail, label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
            { Icon: Phone, label: "Phone / WhatsApp", value: PHONE_DISPLAY, href: `tel:${PHONE_TEL}` },
            { Icon: MapPin, label: "Location", value: CONTACT_ADDRESS },
            { Icon: MessageCircle, label: "Hours", value: CONTACT_HOURS },
          ].map(({ Icon, label, value, href }) => (
            <div key={label} className="flex items-start gap-4 bg-card border border-border rounded-xl p-4">
              <div className="size-9 bg-secondary rounded-lg grid place-items-center shrink-0">
                <Icon className="size-4 text-brass" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5 font-medium">{label}</p>
                {href ? (
                  <a href={href} className="text-sm font-semibold text-foreground hover:text-brass transition">
                    {value}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
