import { Check, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";

const values = [
  { Icon: Check, n: "01", t: "Curated, not crowded", d: "Every item earns its place. Weâ€™d rather show you one perfect piece than fifty mediocre ones." },
  { Icon: Truck, n: "02", t: "Pakistan-wide dispatch", d: "We deliver all across Pakistan â€” 2â€“5 working days to every city and town in the country." },
  { Icon: ShieldCheck, n: "03", t: "Honest pricing, always", d: "No inflated MRPs. No fake discounts. The price you see is the fairest one we could find." },
  { Icon: RotateCcw, n: "04", t: "7-day no-questions returns", d: "Change of heart? Pick-up from your door, refund in 48 hours. Zero friction." },
];

export function ValueStrip() {
  return (
    <section className="bg-paper py-14 lg:py-20 border-y border-coal/8" aria-label="Why shop with Kifayat">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10 lg:mb-14">
          <div>
            <p className="eyebrow text-coal/75 mb-3">Before you add to bag</p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.9] max-w-xl">
              Shop with a little more certainty<span className="text-brass-deep">.</span>
            </h2>
          </div>
          <p className="text-coal/60 text-sm leading-relaxed max-w-sm">
            Straightforward delivery, payment and returns information â€” so the important details are clear before checkout.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {values.map((v) => (
            <div key={v.n} className="border-t border-coal/15 pt-6">
              <div className="flex items-center justify-between mb-6">
                <p className="font-mono text-xs text-coal/70">NÂ° {v.n}</p>
                <v.Icon className="size-4 text-brass" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="font-display italic text-3xl lg:text-4xl leading-tight mb-4">{v.t}</h3>
              <p className="text-coal/65 text-sm leading-relaxed">{v.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 lg:mt-16 pt-5 border-t border-coal/10 flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-coal/85">
          <span className="inline-flex items-center gap-2"><Check className="size-3 text-brass" strokeWidth={2} /> Prices shown in PKR</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="size-3 text-brass" strokeWidth={2} /> Cash on delivery at checkout</span>
          <span className="inline-flex items-center gap-2"><Headphones className="size-3 text-brass" strokeWidth={2} /> contact@kifayat.co</span>
        </div>
      </div>
    </section>
  );
}
