import { motion } from "framer-motion";

export function FounderLetter() {
  return (
    <section className="bg-bone py-24 lg:py-40 relative overflow-hidden">
      <div className="max-w-[1100px] mx-auto px-5 lg:px-10">
        <div className="flex items-center gap-3 eyebrow text-coal/80 mb-10">
          <span className="h-px w-8 bg-coal/30" /> A letter Â· from the founder
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="font-display italic text-3xl md:text-4xl lg:text-5xl leading-[1.15] text-coal/90 tracking-tight space-y-8"
        >
          <p>
            Bismillah â€”
          </p>
          <p>
            We started Kifayat because too much of what arrives at our doors in Pakistan is <span className="text-brass">loud</span>, lazily packed, or quietly fake. We wanted a smaller shelf. Fewer things, each one chosen on purpose, each one honest about its price.
          </p>
          <p>
            What you see here is the shelf I keep at home â€” eight to twelve pieces a week, photographed in our studio, packed by hand, and sent anywhere in the country. If something doesn't sit right, send it back. No questions, no charge.
          </p>
          <p className="text-coal/65 text-2xl md:text-3xl lg:text-4xl">
            Take your time. Buy slowly. <span className="text-coal">â€” shukria.</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="mt-14 flex items-end gap-6"
        >
          <svg viewBox="0 0 200 70" className="h-14 w-auto text-coal" aria-hidden>
            <path
              d="M5 50 C 20 10, 40 70, 60 30 S 100 60, 130 25 S 180 55, 195 30"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M50 55 C 70 35, 90 65, 110 45"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
          <div>
            <p className="font-display italic text-lg">Kifayat</p>
            <p className="eyebrow text-coal/80 mt-1">Founder Â· Kifayat</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
