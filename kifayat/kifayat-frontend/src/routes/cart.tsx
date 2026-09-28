import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/landing/PageShell";
import {
  Minus, Plus, Trash, ShoppingBag, ArrowUpRight,
  Banknote, AlertTriangle,
} from "lucide-react";
import { TrustBar } from "@/components/trust/TrustBar";
import { useCart, cart, cartTotals, refreshCartPrices, validateCartStock, FLAT_DELIVERY_FEE, fetchDeliveryFee, displayUnitPrice } from "@/lib/cart-store";
import type { CartItem, StockWarning } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { unapplyVoucherFromProduct } from "@/lib/voucher.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const items = useCart();
  const { user } = useAuth();
  const t = useT();
  const [deliveryFee, setDeliveryFee] = useState<number>(FLAT_DELIVERY_FEE);
  const { subtotal, shipping, total, count } = cartTotals(items, deliveryFee, user);
  const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([]);
  const [validating, setValidating] = useState(true);

  // Load the admin-editable delivery fee once on mount
  useEffect(() => {
    let alive = true;
    fetchDeliveryFee().then((fee) => {
      if (alive) setDeliveryFee(fee);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Release the applied voucher use when the item leaves the bag
  function removeItem(item: CartItem) {
    if (item.voucher && item.product_id && user) {
      unapplyVoucherFromProduct(item.voucher.voucherId, item.product_id).catch(() => {});
    }
    cart.remove(item.slug, item.variation);
  }

  // Silently refresh prices and validate stock from backend on every cart open
  useEffect(() => {
    Promise.all([
      refreshCartPrices(),
      validateCartStock().then((r) => {
        setStockWarnings(r.warnings);
        setValidating(false);
      }),
    ]);
  }, []);

  const hasStockIssues = stockWarnings.length > 0;
  const unavailableIds = new Set(stockWarnings.filter((w) => w.type === "unavailable").map((w) => w.productId));

  return (
    <PageShell>
      <section className="bg-coal text-bone">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-10 lg:pt-20 pb-12 lg:pb-24">
          <div className="flex items-center justify-between eyebrow text-bone/60 mb-8 lg:mb-10">
            <span className="flex items-center gap-3"><span className="h-px w-8 bg-bone/40" /> Chapter 04 · The Bag</span>
            <span className="hidden sm:inline">{count} {count === 1 ? "object" : "objects"}</span>
          </div>
          <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-end">
            <h1 className="lg:col-span-8 font-display italic text-5xl sm:text-6xl lg:text-[8.5rem] leading-[0.85]">
              Your<br />selection<span className="text-brass">.</span>
            </h1>
            <p className="lg:col-span-4 text-bone/70 text-sm lg:text-base leading-relaxed max-w-sm">
              A quiet pause before purchase. Review, adjust, or set aside for later — then Cash on Delivery, anywhere in Pakistan.
            </p>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <section className="max-w-[1600px] mx-auto px-5 lg:px-10 py-12 lg:py-24">
          <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] gap-10 lg:gap-20">

            {/* ── Item list ── */}
            <div>
              {/* Desktop column headers */}
              <div className="hidden sm:grid sm:grid-cols-[64px_1fr_auto_auto_40px] gap-4 px-2 pb-4 mb-2 border-b border-coal/15 eyebrow text-muted-foreground text-xs">
                <span />
                <span>Object</span>
                <span>Quantity</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              <ul className="divide-y divide-coal/10">
                {items.map((item, idx) => (
                  <li key={item.slug}>
                    {/* ── Mobile card layout ── */}
                    <div className="sm:hidden py-5 flex gap-4">
                      <div className="size-20 shrink-0 bg-paper overflow-hidden">
                        <img src={item.image} alt={item.name} className="size-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div>
                          <p className="eyebrow text-muted-foreground text-[10px]">N° {String(idx + 1).padStart(2, "0")} · {item.brand}</p>
                          <Link
                            to="/products/$productId"
                            params={{ productId: item.slug }}
                            className="font-display italic text-base leading-tight line-clamp-2 hover:text-brass transition"
                          >
                            {item.name}
                          </Link>
                          {item.variation && (
                            <p className="text-xs text-coal/50 mt-0.5">
                              Variation: <span className="font-medium text-coal/70">{item.variation}</span>
                            </p>
                          )}
                          {item.voucher && item.original_price != null ? (
                            <p className="font-mono text-xs text-muted-foreground mt-0.5">
                              <span className="line-through">Rs {item.original_price.toLocaleString()}</span>{" "}
                              <span className="text-emerald-700 font-semibold">Rs {displayUnitPrice(item, user).toLocaleString()} each</span>{" "}
                              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wide">
                                voucher −{item.voucher.percent}%
                              </span>
                            </p>
                          ) : (
                            <p className="font-mono text-xs text-muted-foreground mt-0.5">Rs {displayUnitPrice(item, user).toLocaleString()} each</p>
                          )}
                        </div>
                        {unavailableIds.has(item.product_id ?? item.slug) && (
                          <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertTriangle className="size-3" strokeWidth={2} /> {t("cart.outOfStock")}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 border border-coal/15 w-fit">
                            <button onClick={() => cart.updateQty(item.slug, item.qty - 1, item.variation)} className="size-10 grid place-items-center hover:bg-coal hover:text-bone transition" aria-label="Decrease">
                              <Minus className="size-3" strokeWidth={1.5} />
                            </button>
                            <span className="w-7 text-center font-mono text-sm">{item.qty}</span>
                            <button onClick={() => cart.updateQty(item.slug, item.qty + 1, item.variation)} className="size-10 grid place-items-center hover:bg-coal hover:text-bone transition" aria-label="Increase">
                              <Plus className="size-3" strokeWidth={1.5} />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm">Rs {(displayUnitPrice(item, user) * item.qty).toLocaleString()}</span>
                            <button onClick={() => removeItem(item)} className="size-10 grid place-items-center text-coal/40 hover:text-red-600 transition" aria-label="Remove">
                              <Trash className="size-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Desktop row layout ── */}
                    <div className="hidden sm:grid sm:grid-cols-[64px_1fr_auto_auto_40px] gap-4 items-center py-5">
                      <div className="size-14 bg-paper overflow-hidden">
                        <img src={item.image} alt={item.name} className="size-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="eyebrow text-muted-foreground text-[10px]">N° {String(idx + 1).padStart(2, "0")} · {item.brand}</p>
                        <Link
                          to="/products/$productId"
                          params={{ productId: item.slug }}
                          className="font-display italic text-lg leading-tight line-clamp-2 hover:text-brass transition"
                        >
                          {item.name}
                        </Link>
                        {item.variation && (
                          <p className="text-xs text-coal/50 mt-0.5">
                            Variation: <span className="font-medium text-coal/70">{item.variation}</span>
                          </p>
                        )}
                        {item.voucher && item.original_price != null ? (
                          <p className="font-mono text-xs text-muted-foreground mt-1">
                            <span className="line-through">Rs {item.original_price.toLocaleString()}</span>{" "}
                            <span className="text-emerald-700 font-semibold">Rs {displayUnitPrice(item, user).toLocaleString()} each</span>{" "}
                            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wide">
                              voucher −{item.voucher.percent}%
                            </span>
                          </p>
                        ) : (
                          <p className="font-mono text-xs text-muted-foreground mt-1">Rs {displayUnitPrice(item, user).toLocaleString()} each</p>
                        )}
                        {unavailableIds.has(item.product_id ?? item.slug) && (
                          <p className="flex items-center gap-1 text-xs text-red-600 font-medium mt-1">
                            <AlertTriangle className="size-3" strokeWidth={2} /> {t("cart.outOfStock")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 border border-coal/15 w-fit">
                        <button onClick={() => cart.updateQty(item.slug, item.qty - 1, item.variation)} className="size-9 grid place-items-center hover:bg-coal hover:text-bone transition" aria-label="Decrease">
                          <Minus className="size-3" strokeWidth={1.5} />
                        </button>
                        <span className="w-8 text-center font-mono text-sm">{item.qty}</span>
                        <button onClick={() => cart.updateQty(item.slug, item.qty + 1, item.variation)} className="size-9 grid place-items-center hover:bg-coal hover:text-bone transition" aria-label="Increase">
                          <Plus className="size-3" strokeWidth={1.5} />
                        </button>
                      </div>
                      <span className="text-right font-mono">Rs {(displayUnitPrice(item, user) * item.qty).toLocaleString()}</span>
                      <button onClick={() => removeItem(item)} className="size-8 grid place-items-center text-coal/40 hover:text-red-600 transition" aria-label="Remove">
                        <Trash className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Order summary ── */}
            <aside className="lg:sticky lg:top-28 h-fit">
              <div className="border border-coal/15 p-6 sm:p-8 lg:p-10 bg-paper">
                <div className="eyebrow text-muted-foreground mb-6">§ {t("cart.title")}</div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="eyebrow text-muted-foreground">{t("cart.subtotal")}</dt>
                    <dd className="font-mono">Rs {subtotal.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="eyebrow text-muted-foreground">{t("cart.shipping")}</dt>
                    <dd className="font-mono">Rs {shipping}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground mt-2">Cheapest Delivery in Pakistan</p>
                <div className="mt-6 pt-6 border-t border-coal/15 flex items-baseline justify-between">
                  <span className="eyebrow text-muted-foreground">Total · PKR</span>
                  <span className="font-display italic text-3xl lg:text-4xl text-brass">Rs {total.toLocaleString()}</span>
                </div>
                {hasStockIssues && !validating ? (
                  <span className="group mt-8 w-full inline-flex items-center justify-between gap-3 bg-coal/40 text-bone/40 eyebrow px-6 py-4 cursor-not-allowed">
                    {t("cart.checkout")}
                    <ArrowUpRight className="size-4" strokeWidth={1.5} />
                  </span>
                ) : (
                  <Link
                    to="/checkout"
                    className="group mt-8 w-full inline-flex items-center justify-between gap-3 bg-coal text-bone eyebrow px-6 py-4 hover:bg-brass hover:text-coal transition"
                  >
                    {t("cart.checkout")}
                    <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" strokeWidth={1.5} />
                  </Link>
                )}
                {hasStockIssues && !validating && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs space-y-1">
                    <p className="font-medium flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" strokeWidth={2} /> {t("cart.stockIssues")}
                    </p>
                    <p>{t("cart.stockIssuesHint")}</p>
                  </div>
                )}
                <div className="mt-8 pt-6 border-t border-coal/15 space-y-4">
                  <TrustBar />
                  <p className="flex items-center gap-2 text-xs text-coal/70">
                    <Banknote className="size-3.5 text-brass shrink-0" strokeWidth={1.5} />
                    {t("cart.noAdvance")}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
    </PageShell>
  );
}

function EmptyCart() {
  const t = useT();
  return (
    <section className="max-w-3xl mx-auto px-5 py-24 text-center">
      <ShoppingBag className="size-12 mx-auto text-coal/30 mb-6" strokeWidth={1.2} />
      <h2 className="font-display italic text-4xl lg:text-6xl">{t("cart.empty")}<span className="text-brass">.</span></h2>
      <p className="text-muted-foreground mt-4 max-w-md mx-auto">{t("products.browseHint")}</p>
      <Link to="/products" className="inline-flex items-center gap-2 mt-10 bg-coal text-bone eyebrow px-6 py-4 hover:bg-brass hover:text-coal transition">
        {t("cart.emptyCta")} <ArrowUpRight className="size-4" strokeWidth={1.5} />
      </Link>
    </section>
  );
}
