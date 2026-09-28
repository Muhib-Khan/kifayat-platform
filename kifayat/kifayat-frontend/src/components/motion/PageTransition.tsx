import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const isAdmin = pathname.startsWith("/admin");

  // Admin navigations are frequent, heavy pages. AnimatePresence mode="wait"
  // holds the new page unmounted until the old one has faded out — a serialized
  // ~250ms delay before the next page can even start loading — and keying the
  // whole admin subtree by pathname forces the sidebar/layout to remount and
  // opacity-flash on every click. Admin content renders directly; each admin
  // page already animates in with its own motion wrapper. Storefront keeps the
  // curtain transition.
  if (reduceMotion || isAdmin) return <>{children}</>;

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {!isAdmin && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <motion.div
            key={pathname + "-top"}
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0 }}
            exit={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ height: "50%", transformOrigin: "top" }}
            className="absolute inset-x-0 top-0 bg-coal"
          />
          <motion.div
            key={pathname + "-bottom"}
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0 }}
            exit={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.05 }}
            style={{ height: "50%", transformOrigin: "bottom" }}
            className="absolute inset-x-0 bottom-0 bg-coal"
          />
        </div>
      )}
    </>
  );
}
