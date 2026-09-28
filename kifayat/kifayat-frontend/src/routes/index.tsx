import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";
import { Hero } from "@/components/landing/Hero";
import { Categories } from "@/components/landing/Categories";
import { FlashDeals } from "@/components/landing/FlashDeals";
import { Products } from "@/components/landing/Products";
import { Testimonials } from "@/components/landing/Testimonials";
import { Newsletter } from "@/components/landing/Newsletter";
import { PressStrip } from "@/components/landing/PressStrip";
import { EditStory } from "@/components/landing/EditStory";
import { Lookbook } from "@/components/landing/Lookbook";
import { FounderLetter } from "@/components/landing/FounderLetter";
import { Founders }      from "@/components/landing/Founders";
import { LiveStats } from "@/components/landing/LiveStats";
import { SEO } from "@/components/seo/SEO";
import { HomepageGraphSchema } from "@/components/seo/JsonLd";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <PageShell>
      <SEO
        title="Kifayat | Online Shopping in Pakistan - Official Store"
        description="Shop online at Kifayat.co for quality fashion, home goods, and electronics in Pakistan. We deliver all over Pakistan — fast, flat-fee shipping and cash on delivery nationwide."
        keywords="online shopping Pakistan, buy electronics online, fashion online Pakistan, home goods Pakistan, Kifayat, Kifayat online shopping"
      />
      <HomepageGraphSchema />
      <Hero />
      <Categories />
      <FlashDeals />
      <Products />
      <EditStory />
      <Testimonials />
      <Lookbook />
      <PressStrip />
      <Founders />
      <FounderLetter />
      <LiveStats />
      <Newsletter />
    </PageShell>
  );
}
