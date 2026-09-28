import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { SEO } from "@/components/seo/SEO";
import { FAQSchema } from "@/components/seo/JsonLd";

export const Route = createFileRoute("/faq")({
  component: FAQ,
});

const groups = [
  {
    title: "Ordering",
    items: [
      ["How do I place an order?", "Browse the catalogue, add items to your cart and proceed to checkout. We deliver on Cash on Delivery — pay the courier in cash when your order arrives. No advance payment and no online payment needed."],
      ["Can I order without an account?", "Yes — guest checkout is supported, but signing up lets you review past orders and earn rewards."],
      ["Do you deliver all across Pakistan?", "Yes — we deliver to every city and town across Pakistan. Dispatch is nationwide."],
    ],
  },
  {
    title: "Delivery",
    items: [
      ["How long does delivery take?", "Most orders arrive within 2–4 business days. Express delivery is available the next day."],
      ["How much does delivery cost?", "Delivery is a flat fee on every order — no minimums, no surprises. The cheapest delivery in Pakistan."],
    ],
  },
  {
    title: "Returns & refunds",
    items: [
      ["What is the return policy?", "You can return unused items in original packaging within 7 days of delivery."],
      ["How long does a refund take?", "Refunds are processed within 5–7 business days after we receive the item."],
      ["What if my item arrives damaged?", "Message us within 48 hours with photos and we'll arrange a free replacement."],
    ],
  },
];

// Flat list for FAQPage schema
const allFaqs = groups.flatMap((g) => g.items.map(([q, a]) => ({ q, a })));

function FAQ() {
  return (
    <PageShell>
      <SEO
        title="FAQ — Frequently Asked Questions"
        description="Common questions about ordering, delivery, payments and returns at Kifayat. Get answers about our Pakistan-wide shipping, COD, and easy return policy."
        path="/faq"
        keywords="Kifayat FAQ, online shopping questions, delivery Pakistan, return policy Pakistan, COD Pakistan"
      />
      <FAQSchema faqs={allFaqs} />

      <PageHeader
        title="Frequently asked questions"
        subtitle="Everything you need to know about shopping with Kifayat."
        breadcrumbs={[{ label: "Home", to: "/" }, { label: "FAQ" }]}
      />

      <section className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="font-display font-semibold text-xl mb-4">{g.title}</h2>
            <div className="space-y-3">
              {g.items.map(([q, a]) => <Item key={q} q={q} a={a} />)}
            </div>
          </div>
        ))}
      </section>
    </PageShell>
  );
}

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-medium">{q}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
}
