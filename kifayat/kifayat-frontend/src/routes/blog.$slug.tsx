import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";
import { SEO, SITE_URL } from "@/components/seo/SEO";
import { BlogPostingSchema, BreadcrumbSchema, FAQSchema } from "@/components/seo/JsonLd";
import { blogPosts } from "@/lib/blog-data";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogArticlePage,
});

function BlogArticlePage() {
  const { slug } = Route.useParams();
  const post = blogPosts.find((p) => p.id === slug);

  if (!post) {
    return (
      <PageShell>
        <div className="text-center py-32 px-4">
          <p className="font-display italic text-5xl text-coal/30">Not found<span className="text-brass">.</span></p>
          <p className="mt-4 text-sm text-coal/55">This story doesn't exist — or it moved.</p>
          <Link
            to="/blog"
            className="mt-8 inline-block eyebrow text-xs border border-coal/20 px-5 py-2.5 hover:bg-coal hover:text-bone transition"
          >
            Back to Stories
          </Link>
        </div>
      </PageShell>
    );
  }

  const url = `${SITE_URL}/blog/${post.id}`;
  const more = blogPosts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <PageShell>
      <SEO
        type="article"
        title={post.title}
        description={post.description}
        path={`/blog/${post.id}`}
        keywords={post.keyword}
        publishedTime={post.dateISO}
        modifiedTime={post.dateISO}
        author={post.author}
        section={post.category}
        tags={[post.keyword, "Pakistan", "online shopping"]}
      />
      <BlogPostingSchema
        title={post.title}
        url={url}
        description={post.description}
        datePublished={post.dateISO}
        image={post.cover}
        authorName={post.author}
      />
      <BreadcrumbSchema
        crumbs={[
          { name: "Home", url: SITE_URL },
          { name: "Stories", url: `${SITE_URL}/blog` },
          { name: post.title, url },
        ]}
      />
      {post.faq.length > 0 && <FAQSchema faqs={post.faq} />}

      <article className="max-w-3xl mx-auto px-4 lg:px-8 py-10 lg:py-16">
        <p className="eyebrow text-[11px] text-coal/40 uppercase">
          {post.category} · {post.readMins} min read
        </p>
        <h1 className="font-display italic text-4xl sm:text-5xl lg:text-6xl leading-[1.02] tracking-tight mt-3">
          {post.title}
        </h1>
        <p className="mt-4 text-sm text-coal/50">
          {post.date} · {post.author}
        </p>

        <img
          src={post.cover}
          alt={post.coverAlt}
          width={1280}
          height={720}
          className="mt-8 w-full aspect-[16/9] object-cover"
        />

        <p className="mt-8 text-lg leading-relaxed text-coal/85">{post.excerpt}</p>

        {post.sections.map((sec) => (
          <section key={sec.heading} className="mt-10">
            <h2 className="font-display italic text-2xl tracking-tight">{sec.heading}</h2>
            {sec.paragraphs.map((para, i) => (
              <p key={i} className="mt-4 leading-relaxed text-coal/80">
                {para}
              </p>
            ))}
          </section>
        ))}

        {/* FAQ */}
        {post.faq.length > 0 && (
          <section className="mt-12 border-t border-coal/10 pt-8">
            <h2 className="font-display italic text-2xl tracking-tight">Common questions</h2>
            <div className="mt-6 space-y-6">
              {post.faq.map((f) => (
                <div key={f.q}>
                  <h3 className="font-medium">{f.q}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-coal/70">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 bg-coal text-bone p-8 text-center">
          <p className="font-display italic text-2xl">
            Shop the edit<span className="text-brass">.</span>
          </p>
          <p className="mt-2 text-sm text-bone/60">Honest prices · nationwide delivery · cash on delivery.</p>
          <a
            href={post.cta.to}
            className="mt-5 inline-block eyebrow text-xs border border-bone/30 px-6 py-3 hover:bg-bone hover:text-coal transition"
          >
            {post.cta.label}
          </a>
        </div>

        {/* More stories */}
        {more.length > 0 && (
          <div className="mt-12 border-t border-coal/10 pt-8">
            <h2 className="font-display italic text-2xl tracking-tight">More stories</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {more.map((m) => (
                <Link key={m.id} to="/blog/$slug" params={{ slug: m.id }} className="group">
                  <img
                    src={m.cover}
                    alt={m.coverAlt}
                    width={800}
                    height={600}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <p className="mt-2 text-sm font-medium leading-snug group-hover:text-brass transition-colors">
                    {m.title}
                  </p>
                  <p className="mt-1 text-xs text-coal/40">{m.readMins} min read</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </PageShell>
  );
}