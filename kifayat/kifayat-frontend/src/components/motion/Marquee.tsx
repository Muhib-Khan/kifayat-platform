import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Marquee({
  children,
  speed = 40,
  reverse = false,
  className = "",
  pauseOnHover = true,
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
  pauseOnHover?: boolean;
}) {
  return (
    <div className={`overflow-hidden group ${className}`}>
      <motion.div
        className="flex shrink-0 whitespace-nowrap"
        initial={{ x: reverse ? "-50%" : "0%" }}
        animate={{ x: reverse ? "0%" : "-50%" }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
        style={pauseOnHover ? { animationPlayState: "running" } : undefined}
        whileHover={pauseOnHover ? { transition: { duration: 0 } } : undefined}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
