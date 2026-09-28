import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";
import { Heart, Sparkles, Truck, Users, ArrowUpRight, Mail } from "lucide-react";
import { SEO } from "@/components/seo/SEO";
import { OrganizationSchema } from "@/components/seo/JsonLd";
import { Reveal } from "@/components/motion/Reveal";
import { WebsiteReviewForm } from "@/components/trust/WebsiteReviewForm";
import img from "@/assets/edit-story.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const values = [
  {
    Icon: Heart,
    title: "Made for Pakistan",
    text: "We're a Pakistani team. We know what shoppers here want, and how fast they need it.",
  },
  {
    Icon: Sparkles,
    title: "Only what's worth it",
    text: "We check every product before it goes live. No duplicates, no junk — only things we'd buy ourselves.",
  },
  {
    Icon: Truck,
    title: "Delivery you can trust",
    text: "We deliver all over Pakistan in 2–4 days. Cash on Delivery and easy returns are always available.",
  },
  {
    Icon: Users,
    title: "Real people, real replies",
    text: "Email us at contact@kifayat.co and a real person answers — usually within a few hours.",
  },
];

function AboutPage() {
  return (
    <PageShell>
      <SEO
        title="Our Story — Kifayat | Honest Online Shopping in Pakistan"
        description="Kifayat is a small Pakistani shop with products we check ourselves, fair prices, and fast delivery all over Pakistan. No fakes, no hidden charges, no tricks."
        path="/about"
        keywords="about Kifayat, our story, Pakistani online store, honest online shopping Pakistan, nationwide delivery"
      />
      <OrganizationSchema />

      {/* ── Hero ── */}
      <section className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-12 lg:pt-20 pb-14 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-end">
          <div className="lg:col-span-6">
            <p className="eyebrow text-coal/50 mb-6">Our story</p>
            <h1 className="font-display italic text-5xl lg:text-7xl xl:text-8xl leading-[0.95] tracking-tight">
              The shop we
              <br />
              wished existed<span className="text-brass">.</span>
            </h1>
          </div>
          <div className="lg:col-span-6 lg:pb-3">
            <p className="text-coal/70 leading-relaxed lg:text-lg max-w-xl">
              Buying online in Pakistan should be simple. But too often it's a gamble —
              fake products, wrong photos, prices that change at checkout, or deliveries
              that take weeks.
            </p>
            <p className="text-coal/70 leading-relaxed lg:text-lg max-w-xl mt-4">
              We got tired of it. So we built Kifayat: a small shop with products we checked
              ourselves, fair prices, and delivery you can rely on. That's it. No tricks.
            </p>
          </div>
        </div>
      </section>

      {/* ── Story with image ── */}
      <section className="bg-paper border-y border-coal/8 py-16 lg:py-28">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-6">
            <div className="relative">
              <img
                src={img}
                alt="The Kifayat collection"
                loading="lazy"
                width={1280}
                height={1280}
                className="w-full aspect-[4/5] lg:aspect-[5/4] object-cover"
              />
              <div className="absolute -bottom-6 right-4 lg:right-8 bg-coal text-bone px-6 py-5 max-w-[65%]">
                <p className="eyebrow text-bone/50 mb-1">Since day one</p>
                <p className="font-display italic text-2xl lg:text-3xl leading-tight">
                  No fakes. No surprises.
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6 lg:pl-6">
            <p className="eyebrow text-coal/50 mb-5">Why we started</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.95] tracking-tight">
              An honest shop,<br />plain and simple<span className="text-brass">.</span>
            </h2>
            <ul className="mt-9 space-y-5">
              {[
                "We pick every product ourselves. Before anything goes live, a real person checks the supplier, the photos, and the price.",
                "Prices are fair — what you see is what you pay. No hidden charges at checkout.",
                "We deliver all over Pakistan. Most orders reach you in 2–4 days, and you can pay cash on delivery if you like.",
                "If something goes wrong, we fix it. Message contact@kifayat.co and a real person helps — not a bot.",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="mt-1 size-1.5 shrink-0 bg-brass" />
                  <p className="text-coal/75 leading-relaxed lg:text-lg">{t}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="max-w-[1600px] mx-auto px-5 lg:px-10 py-16 lg:py-28">
        <div className="flex items-end justify-between mb-10 lg:mb-14">
          <div>
            <p className="eyebrow text-coal/50 mb-3">What we stand for</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.95] tracking-tight">
              How we work<span className="text-brass">.</span>
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {values.map(({ Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 0.05} className="border border-coal/12 bg-card p-6 lg:p-7">
              <Icon className="size-6 text-brass mb-5" strokeWidth={1.5} />
              <h3 className="font-display italic text-2xl leading-tight mb-2">{title}</h3>
              <p className="text-sm text-coal/65 leading-relaxed">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Leave a review ── */}
      <section className="max-w-[1600px] mx-auto px-5 lg:px-10 pb-16 lg:pb-28">
        <div className="flex items-end justify-between mb-10 lg:mb-14">
          <div>
            <p className="eyebrow text-coal/50 mb-3">Real feedback</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.95] tracking-tight">
              Heard it from customers<span className="text-brass">.</span>
            </h2>
          </div>
        </div>
        <div className="max-w-2xl">
          <WebsiteReviewForm />
        </div>
      </section>

      {/* ── Contact band ── */}
      <section className="bg-coal text-bone">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 py-16 lg:py-24 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
          <div>
            <p className="eyebrow text-bone/50 mb-4">Talk to us</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.95] tracking-tight">
              Questions? We're here<span className="text-brass">.</span>
            </h2>
            <p className="mt-5 text-bone/70 leading-relaxed max-w-lg">
              Email us any time — we reply quickly, in simple words, and we actually help.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <a
              href="mailto:contact@kifayat.co"
              className="inline-flex items-center justify-center gap-2.5 bg-brass text-coal eyebrow px-7 py-4 hover:bg-bone hover:text-coal transition"
            >
              <Mail className="size-4" strokeWidth={1.5} /> contact@kifayat.co
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 border border-bone/25 text-bone eyebrow px-7 py-4 hover:border-brass hover:text-brass transition"
            >
              Contact page <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

