import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { SEO, SITE_URL } from "@/components/seo/SEO";
import { BreadcrumbSchema } from "@/components/seo/JsonLd";
import { blogPosts } from "@/lib/blog-data";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
});

function BlogIndexPage() {
  return (
    <PageShell>
      <SEO
        title="Kifayat Stories — Shopping Guides for Pakistan"
        description="Buying guides, product roundups and safe-shopping tips for Pakistan — honest prices, real PKR figures, COD advice from Kifayat."
        path="/blog"
        keywords="shopping guide Pakistan, buy online Pakistan, product roundup Pakistan, Kifayat stories"
      />
      <BreadcrumbSchema
        crumbs={[
          { name: "Home", url: SITE_URL },
          { name: "Stories", url: `${SITE_URL}/blog` },
        ]}
      />
      <PageHeader
        title="Stories"
        subtitle="Guides, roundups & how-tos for smarter shopping in Pakistan."
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Stories" },
        ]}
      />

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <Link
              key={post.id}
              to="/blog/$slug"
              params={{ slug: post.id }}
              className="group border border-coal/10 hover:border-brass/50 transition-colors flex flex-col"
            >
              <div className="overflow-hidden">
                <img
                  src={post.cover}
                  alt={post.coverAlt}
                  width={800}
                  height={600}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-5 flex flex-col flex-1">
                <p className="eyebrow text-[10px] text-coal/40 uppercase">
                  {post.category} · {post.readMins} min read
                </p>
                <h2 className="font-display italic text-xl leading-snug tracking-tight mt-2 group-hover:text-brass transition-colors">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm text-coal/60 leading-relaxed line-clamp-3">{post.excerpt}</p>
                <p className="mt-auto pt-4 eyebrow text-[11px] text-coal/40">
                  {post.date} · {post.author}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}