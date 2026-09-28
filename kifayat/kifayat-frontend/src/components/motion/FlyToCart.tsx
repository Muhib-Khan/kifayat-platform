import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { consumePendingFlights, type FlyToCartDetail } from "./fly-to-cart-event";

type Flight = {
  id: number;
  src: string;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number };
};

export function FlyToCart() {
  const [flights, setFlights] = useState<Flight[]>([]);
  useEffect(() => {
    const play = (d: FlyToCartDetail) => {
      const id = Date.now() + Math.random();
      setFlights((f) => [...f, { ...d, id }]);
      setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), 1100);
      // bump cart icon
      const cart = document.querySelector<HTMLElement>("[data-cart-icon]");
      if (cart) {
        cart.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.35)" },
            { transform: "scale(1)" },
          ],
          { duration: 450, delay: 800, easing: "cubic-bezier(0.34,1.56,0.64,1)" },
        );
      }
    };
    consumePendingFlights().forEach(play);
    const handler = (e: Event) => {
      consumePendingFlights();
      play((e as CustomEvent).detail as FlyToCartDetail);
    };
    window.addEventListener("kfy:fly", handler);
    return () => window.removeEventListener("kfy:fly", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <AnimatePresence>
        {flights.map((f) => (
          <motion.img
            key={f.id}
            src={f.src}
            alt=""
            initial={{
              x: f.from.x,
              y: f.from.y,
              width: f.from.w,
              height: f.from.h,
              opacity: 1,
              borderRadius: 8,
            }}
            animate={{
              x: f.to.x - 24,
              y: f.to.y - 24,
              width: 48,
              height: 48,
              opacity: 0.4,
              borderRadius: 999,
            }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.95, ease: [0.65, 0, 0.35, 1] }}
            className="object-cover shadow-e3 fixed top-0 left-0"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
