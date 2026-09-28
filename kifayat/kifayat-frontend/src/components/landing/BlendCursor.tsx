import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function BlendCursor() {
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerDown = (e: PointerEvent) => {
      setTouchPoint({ x: e.clientX, y: e.clientY, id: Date.now() });
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {touchPoint && (
          <motion.div
            key={touchPoint.id}
            aria-hidden
            initial={{ opacity: 0.85, scale: 0.25 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            onAnimationComplete={() => setTouchPoint(null)}
            style={{ left: touchPoint.x, top: touchPoint.y }}
            className="fixed z-[201] pointer-events-none -ml-5 -mt-5 size-10 rounded-full border-2 border-brass"
          >
            <span className="absolute inset-2 rounded-full bg-brass/40" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}