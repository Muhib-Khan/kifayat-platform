export type FlyToCartDetail = {
  src: string;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number };
};

const pendingFlights: FlyToCartDetail[] = [];

export function consumePendingFlights() {
  return pendingFlights.splice(0, pendingFlights.length);
}

export function flyToCart(src: string, fromEl: HTMLElement) {
  if (typeof window === "undefined") return;
  const cart = document.querySelector<HTMLElement>("[data-cart-icon]");
  if (!cart) return;
  const a = fromEl.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  const detail: FlyToCartDetail = {
    src,
    from: { x: a.left, y: a.top, w: a.width, h: a.height },
    to: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
  };
  pendingFlights.push(detail);
  window.dispatchEvent(
    new CustomEvent("kfy:fly", {
      detail,
    }),
  );
}