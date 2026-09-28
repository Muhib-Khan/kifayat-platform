import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * Massive italic wordmark that scrub-scrolls horizontally as it enters the viewport.
 * Used as section divider on the homepage.
 */
export function KineticWordmark({
  text,
  eyebrow,
  tone = "bone",
  align = "left",
}: {
  text: string;
  eyebrow?: string;
  tone?: "bone" | "coal";
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 24, mass: 0.25 });
  const x = useTransform(smooth, [0, 1], align === "left" ? ["-20%", "10%"] : ["20%", "-10%"]);
  const opacity = useTransform(smooth, [0, 0.25, 0.75, 1], [0.05, 1, 1, 0.4]);

  const bg = tone === "coal" ? "bg-coal text-bone" : "bg-bone text-coal";

  return (
    <section ref={ref} className={`${bg} relative overflow-hidden py-16 lg:py-24 border-y border-current/5`}>
      {eyebrow && (
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 mb-6">
          <span className="eyebrow opacity-50 flex items-center gap-3">
            <span className="h-px w-8 bg-current opacity-40" /> {eyebrow}
          </span>
        </div>
      )}
      <motion.div
        style={reduce ? undefined : { x, opacity }}
        className="whitespace-nowrap font-display italic text-[18vw] lg:text-[16vw] leading-[0.85] tracking-tight will-change-transform"
      >
        {text}<span className="text-brass">.</span>
      </motion.div>
    </section>
  );
}
