import { motion } from "framer-motion";

const FOUNDERS = [
  {
    name:  "Muhib Khan",
    role:  "Co-Founder, Frontend Development",
    initial: "M",
    quote: "We built Kifayat because honest commerce should be the default, not the exception.",
  },
  {
    name:  "Aaliyan Sheikh",
    role:  "Co-Founder, Backend Development",
    initial: "A",
    quote: "Every product on this shelf was chosen with the same question: would I buy this myself?",
  },
  {
    name:  "Ashar Khan",
    role:  "Co-Founder, Research & Strategy",
    initial: "A",
    quote: "Pakistan deserves a store that respects its buyers — fair prices, no noise, no tricks.",
  },
];

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.14 } },
};
const item = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export function Founders() {
  return (
    <section className="bg-coal text-bone py-24 lg:py-36 relative overflow-hidden">
      {/* Kinetic background numeral */}
      <span
        aria-hidden
        className="absolute -right-8 top-1/2 -translate-y-1/2 font-display italic text-[28vw] leading-none text-bone/[0.025] select-none pointer-events-none"
      >
        03
      </span>

      <div className="max-w-[1600px] mx-auto px-5 lg:px-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between mb-16 lg:mb-24 border-b border-bone/10 pb-8"
        >
          <div>
            <p className="eyebrow text-bone/40 mb-3 flex items-center gap-3">
              <span className="h-px w-6 bg-bone/20" /> The People Behind It
            </p>
            <h2 className="font-display italic text-4xl lg:text-6xl leading-[0.9] tracking-tight">
              Co-Founders<span className="text-brass-deep">.</span>
            </h2>
          </div>
          <p className="hidden lg:block text-bone/40 text-sm max-w-[22ch] text-right leading-relaxed">
            Three people, one mission — commerce that treats Pakistan right.
          </p>
        </motion.div>

        {/* Founders grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-8%" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-px bg-bone/10"
        >
          {FOUNDERS.map((f, i) => (
            <motion.div key={f.name} variants={item} className="bg-coal px-8 lg:px-12 py-12 lg:py-16 flex flex-col gap-8 group">
              {/* Avatar / initial */}
              <div className="flex items-center gap-4">
                <div className="size-14 border border-bone/20 flex items-center justify-center font-display italic text-2xl text-brass group-hover:border-brass transition-colors duration-300">
                  {f.initial}
                </div>
                <span className="eyebrow text-bone/30 text-[10px]">0{i + 1} / 03</span>
              </div>

              {/* Quote */}
              <blockquote className="font-display italic text-xl lg:text-2xl leading-[1.3] text-bone/85 flex-1">
                "{f.quote}"
              </blockquote>

              {/* Name + role */}
              <div className="border-t border-bone/10 pt-6">
                <p className="font-display italic text-lg text-bone">{f.name}</p>
                <p className="eyebrow text-brass mt-1">{f.role} · Kifayat</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-0 border-t border-bone/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 eyebrow text-bone/30"
        >
          <span>Pakistan — Est. 2024</span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-brass animate-pulse" />
            Dispatching Pakistan-wide daily
          </span>
        </motion.div>
      </div>
    </section>
  );
}
