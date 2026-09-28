import { PageShell, PageHeader } from "@/components/landing/PageShell";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

type Section = {
  heading: string;
  /** Plain paragraph, or an array of bullet-point strings. */
  body: string | string[];
  /** Optional highlighted callout shown above the body. */
  callout?: string;
};

type LegalPageProps = {
  title: string;
  subtitle?: string;
  effectiveDate?: string;
  sections: Section[];
  /** Links shown in the "See also" footer strip. */
  related?: { label: string; to: string }[];
};

function Body({ body }: { body: string | string[] }) {
  if (typeof body === "string") {
    return <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>;
  }
  return (
    <ul className="space-y-2 mt-1">
      {body.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-1.5 size-1.5 rounded-full bg-brass shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({ title, subtitle, effectiveDate, sections, related }: LegalPageProps) {
  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ label: "Home", to: "/" }, { label: title }]}
      />

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Trust badge */}
        <div className="flex items-center gap-3 mb-10 px-5 py-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
          <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-700">
            This document is legally binding. By using Kifayat you confirm you have read and accepted these terms.
          </p>
        </div>

        <article className="space-y-10">
          {sections.map((s, idx) => (
            <section key={s.heading} className="scroll-mt-24" id={`section-${idx}`}>
              <h2 className="font-display font-semibold text-xl mb-3 flex items-start gap-2">
                <span className="text-brass font-mono text-sm mt-1 shrink-0 w-6">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              {s.callout && (
                <div className="mb-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-sm font-medium text-amber-800">
                  {s.callout}
                </div>
              )}
              <div className="pl-8">
                <Body body={s.body} />
              </div>
            </section>
          ))}
        </article>

        {/* Related links strip */}
        {related && related.length > 0 && (
          <div className="mt-14 pt-6 border-t border-border">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">See also</p>
            <div className="flex flex-wrap gap-3">
              {related.map((r) => (
                <Link
                  key={r.to}
                  to={r.to}
                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline hover:text-brass transition-colors"
                >
                  {r.label} →
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t border-border pt-6 mt-10">
          Effective date: {effectiveDate ?? "July 2026"} · Kifayat, Pakistan ·{" "}
          <a href="mailto:contact@kifayat.co" className="underline hover:text-foreground transition-colors">
            contact@kifayat.co
          </a>
        </p>
      </div>
    </PageShell>
  );
}
