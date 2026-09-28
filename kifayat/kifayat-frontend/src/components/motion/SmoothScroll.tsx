import { useEffect, useState, type ReactNode } from "react";
import { LenisContext } from "./LenisContext";

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<import("lenis").default | null>(null);

  useEffect(() => {
    // Keep the desktop effect; touch devices already use native scrolling.
    const capable = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let cancelled = false;
    let generation = 0;
    let raf = 0;
    let instance: import("lenis").default | null = null;

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const loop = (time: number) => {
      if (!instance || document.hidden) { raf = 0; return; }
      instance.raf(time);
      raf = requestAnimationFrame(loop);
    };
    const resume = () => {
      if (document.hidden) stop();
      else if (instance && !raf) raf = requestAnimationFrame(loop);
    };
    const update = async () => {
      const current = ++generation;
      stop();
      instance?.destroy();
      instance = null;
      setLenis(null);
      if (!capable.matches) return;
      try {
        const { default: Lenis } = await import("lenis");
        if (cancelled || current !== generation || !capable.matches) return;
        instance = new Lenis({
          lerp: 0.095, smoothWheel: true, wheelMultiplier: 0.88,
          touchMultiplier: 1.1, syncTouch: false,
        });
        setLenis(instance);
        resume();
      } catch {
        // Native scrolling remains available if this optional chunk fails.
      }
    };
    void update();
    capable.addEventListener("change", update);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      generation++;
      capable.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", resume);
      stop();
      instance?.destroy();
    };
  }, []);

  return <LenisContext.Provider value={{ lenis }}>{children}</LenisContext.Provider>;
}
