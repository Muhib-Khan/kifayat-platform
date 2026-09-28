const items = [
  { q: "The curation is unmatched. Finally a shopping experience in Karachi that feels intentional, not transactional.", who: "Bilal R.", where: "DHA Phase 6", city: "Karachi" },
  { q: "Delivery was at my door within hours. The packaging alone made me trust the brand on first order.", who: "Ayesha K.", where: "Clifton", city: "Karachi" },
  { q: "I came for one thing and stayed for the editorial. Kifayat reads like a magazine and ships like a logistics company.", who: "Saima A.", where: "Gulshan-e-Iqbal", city: "Karachi" },
];

export function Testimonials() {
  return (
    <section className="bg-coal text-bone py-28 lg:py-40 px-5 lg:px-10">
      <div className="max-w-5xl mx-auto text-center">
        <p className="eyebrow text-bone/80 mb-10">Loved across the city</p>
        <div className="w-px h-16 bg-bone/20 mx-auto mb-10" />

        <div className="space-y-12 sm:space-y-20 lg:space-y-28">
          {items.map((t, i) => (
            <figure key={i} className="max-w-3xl mx-auto">
              <blockquote className="font-display italic text-3xl sm:text-4xl lg:text-6xl leading-[1.1] tracking-tight">
                &ldquo;{t.q}&rdquo;
              </blockquote>
              <figcaption className="mt-8 eyebrow text-bone/80">
                {t.who} â€” {t.where}, {t.city}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="w-px h-16 bg-bone/20 mx-auto mt-16" />
        <div className="mt-10 grid grid-cols-3 gap-6 max-w-xl mx-auto text-center">
          {[
            { n: "12k+", l: "Monthly shoppers" },
            { n: "4.8", l: "Avg. rating" },
            { n: "98%", l: "On-time delivery" },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-display italic text-4xl lg:text-5xl">{s.n}</p>
              <p className="eyebrow text-bone/40 mt-2">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
