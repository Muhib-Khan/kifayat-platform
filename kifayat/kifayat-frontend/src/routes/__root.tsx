import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { useLenis } from "@/components/motion/LenisContext";
import { PageTransition } from "@/components/motion/PageTransition";
import { Toaster } from "@/components/ui/sonner";
import { FlyToCart } from "@/components/motion/FlyToCart";
import { usePricingSync } from "@/hooks/use-pricing-sync";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { useReceiptStatusSync } from "@/hooks/use-receipt-status-sync";
import { useActiveTime } from "@/hooks/use-active-time";

function ScrollToTop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lenis = useLenis();
  useEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      // Fallback for reduced-motion / before Lenis loads
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname, lenis]);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function Root() {
  usePricingSync();
  useRealtimeSync();
  useOrderStatusSync();
  useReceiptStatusSync();
  useActiveTime();
  return (
    <>
      <SmoothScroll>
        <ScrollToTop />
        <PageTransition>
          <Outlet />
        </PageTransition>
      </SmoothScroll>
      <Toaster />
      <FlyToCart />
    </>
  );
}

function RoutePendingComponent() {
  return (
    <div className="min-h-screen bg-bone" aria-hidden>
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-10 lg:pt-16">
        <div className="h-3 w-28 rounded animate-pulse bg-coal/10" />
        <div className="h-10 w-72 max-w-full rounded animate-pulse bg-coal/10 mt-4" />
        <div className="h-3 w-48 rounded animate-pulse bg-coal/10 mt-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-10 lg:gap-x-5 mt-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square rounded-xl animate-pulse bg-bone/60" />
              <div className="h-3 rounded animate-pulse bg-coal/10 w-3/4" />
              <div className="h-3 rounded animate-pulse bg-coal/10 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  pendingComponent: RoutePendingComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
