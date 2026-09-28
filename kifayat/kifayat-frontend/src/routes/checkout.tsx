import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";
import { useState, useEffect, useRef } from "react";
import { useCart, cart, cartTotals, refreshCartPrices, validateCartStock, FLAT_DELIVERY_FEE, fetchDeliveryFee, displayUnitPrice } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import LocationPicker from "@/components/LocationPicker";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { searchAddress, POPULAR_CITIES } from "@/services/geocoding";
import type { GeocodingResult } from "@/services/geocoding";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhonePK } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  getMyVouchers,
  unapplyVoucherFromProduct,
  voucherAppliedEntry,
  type PurchasedVoucher,
} from "@/lib/voucher.functions";
import {
  ArrowLeft, ArrowUpRight, Check, Loader2, Mail, Plus, RefreshCw, X,
} from "lucide-react";
import { resendOrderConfirmation } from "@/lib/shop.functions";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
});

type ShipmentForm = {
  name: string;
  phone: string;
  phone2: string;
  address: string;
  courierCity: string;
  shpType: string;
  courierCompany: string;
  latitude: number | null;
  longitude: number | null;
};

// ── Confirmed state ────────────────────────────────────────────────────────────
function Confirmed({ order, email }: { order: { order_number: string; total: number }; email: string }) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function getInboxUrl(email: string): string {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (domain.includes("gmail.com")) return "https://mail.google.com";
    if (domain.includes("outlook.com") || domain.includes("hotmail.com") || domain.includes("live.com")) return "https://outlook.live.com";
    if (domain.includes("yahoo.com")) return "https://mail.yahoo.com";
    if (domain.includes("icloud.com") || domain.includes("me.com")) return "https://www.icloud.com/mail";
    return `mailto:${email}`;
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await resendOrderConfirmation(order.order_number);
      setResent(true);
      toast.success(res?.message ?? "Email resent!");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to resend.");
    } finally {
      setResending(false);
    }
  }

  return (
    <PageShell>
      <section className="bg-coal text-bone min-h-screen">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 py-20 lg:py-32">
          <div className="eyebrow text-bone/60 mb-10 flex items-center gap-3">
            <span className="h-px w-8 bg-bone/40" /> Chapter 06 · Confirmation
          </div>
          <div className="grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <p className="eyebrow text-bone/60 mb-6">{order.order_number} · pending confirmation</p>
              <h1 className="font-display italic text-4xl sm:text-6xl lg:text-[9rem] leading-[0.85]">
                Thank you<span className="text-brass">.</span><br />
                Check your email<span className="text-brass">.</span>
              </h1>
            </div>
            <p className="lg:col-span-4 text-bone/70 text-sm lg:text-base leading-relaxed max-w-sm">
              A confirmation link has been sent to <strong className="text-bone">{email}</strong>. Please click it within{" "}
              <strong className="text-bone">24 hours</strong> to confirm your order.
              Pay the courier in cash when your order arrives.
            </p>
          </div>
          <div className="mt-16 flex flex-wrap gap-4">
            <a
              href={getInboxUrl(email)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brass text-coal eyebrow px-7 py-4 hover:bg-bone transition"
            >
              <Mail className="size-4" strokeWidth={1.5} />
              Open email inbox
            </a>
            <button
              onClick={handleResend}
              disabled={resending || resent}
              className="inline-flex items-center gap-2 border border-bone/30 text-bone eyebrow px-7 py-4 hover:border-bone transition disabled:opacity-50"
            >
              {resent ? (
                <><Check className="size-4" strokeWidth={1.5} /> Sent!</>
              ) : resending ? (
                <><Loader2 className="size-4 animate-spin" /> Sending…</>
              ) : (
                <><RefreshCw className="size-4" strokeWidth={1.5} /> Resend confirmation email</>
              )}
            </button>
            <Link
              to="/account/orders"
              className="inline-flex items-center gap-2 border border-bone/30 text-bone eyebrow px-7 py-4 hover:border-bone transition"
            >
              View order history <ArrowUpRight className="size-4" strokeWidth={1.5} />
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 border border-bone/30 text-bone eyebrow px-7 py-4 hover:border-bone transition"
            >
              Continue browsing
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

// ── OTP Modal ─────────────────────────────────────────────────────────────────
function OtpModal({
  userName,
  onClose,
  onVerified,
}: {
  userName: string;
  onClose: () => void;
  onVerified: (email: string) => void;
}) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/orders/shipping-otp", { email: email.trim().toLowerCase(), name: userName || "Customer" });
      toast.success("Verification code sent!");
      setStep("otp");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) { toast.error("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      await api.post("/orders/verify-shipping-otp", { email: email.trim().toLowerCase(), otp });
      toast.success("Email verified!");
      onVerified(email.trim().toLowerCase());
    } catch (e: any) {
      toast.error(e?.message ?? "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-coal/80 backdrop-blur-sm px-4 py-4 sm:py-6">
      <div className="bg-bone text-coal rounded-lg p-5 sm:p-6 w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow text-coal/50 text-xs mb-1">§ Verify</p>
            <h3 className="font-display italic text-2xl">
              Add email<span className="text-brass">.</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-8 grid place-items-center hover:bg-coal/10 rounded transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {step === "email" ? (
          <div className="space-y-4">
            <label className="block">
              <span className="eyebrow text-coal/50 text-xs mb-1.5 block">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="you@example.com"
                autoFocus
                className="w-full h-11 px-4 border border-coal/20 bg-white text-coal text-sm focus:outline-none focus:border-coal"
              />
            </label>
            <button
              onClick={sendOtp}
              disabled={loading}
              className="w-full h-11 bg-coal text-bone eyebrow text-sm flex items-center justify-center gap-2 hover:bg-brass hover:text-coal transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Send verification code
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-coal/60">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <label className="block">
              <span className="eyebrow text-coal/50 text-xs mb-1.5 block">Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                placeholder="000000"
                autoFocus
                className="w-full h-11 px-4 border border-coal/20 bg-white text-coal text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-coal"
              />
            </label>
            <button
              onClick={verifyOtp}
              disabled={loading}
              className="w-full h-11 bg-coal text-bone eyebrow text-sm flex items-center justify-center gap-2 hover:bg-brass hover:text-coal transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Verify &amp; use this email
            </button>
            <button
              onClick={() => setStep("email")}
              className="w-full text-xs text-coal/50 hover:text-coal transition"
            >
              ← Try a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Input primitives ──────────────────────────────────────────────────────────
const inputCls =
  "w-full h-11 px-4 bg-bone/5 border border-bone/20 text-bone outline-none focus:border-brass text-sm transition placeholder:text-bone/30";

function Field({
  label,
  required: req,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="eyebrow text-bone/50 mb-1.5 block text-xs">
        {label}
        {req && <span className="text-brass ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// ── Voucher reservation release ──────────────────────────────────────────────
async function releaseCartVoucherReservations() {
  const applied = cart.items.filter((i) => i.voucher && i.product_id);
  if (applied.length === 0) return;
  await Promise.allSettled(
    applied.map((i) => unapplyVoucherFromProduct(i.voucher!.voucherId, i.product_id!)),
  );
  applied.forEach((i) => cart.removeVoucher(i.slug));
  console.log(`[Checkout] Released ${applied.length} voucher reservation(s).`);
}

// The backend is the single source of truth for whether an order exists.
// Returns the order if the attempt actually succeeded server-side, or null
// if the backend confirms no order was created. Throws if the check itself
// cannot reach the backend.
async function findOrderByClientRequest(clientRequestId: string): Promise<any> {
  const data = await api.get<{ success: boolean; order: any | null }>(
    `/orders/by-request/${encodeURIComponent(clientRequestId)}`,
  );
  return data?.order ?? null;
}

function Checkout() {
  const items = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  const placedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const requestIdRef = useRef<string | null>(null);
  if (requestIdRef.current === null) {
    requestIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  const [emails, setEmails] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [form, setForm] = useState<ShipmentForm>({
    name: "",
    phone: "",
    phone2: "",
    address: "",
    courierCity: "",
    shpType: "Regular",
    courierCompany: "TCS",
    latitude: null,
    longitude: null,
  });
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ order_number: string; total: number } | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(FLAT_DELIVERY_FEE);

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

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  // Load shipment emails from user profile
  useEffect(() => {
    if (!user) return;
    api
      .get<{ success: boolean; loginEmail: string; shipmentEmails: string[] }>(
        "/auth/shipment-emails",
      )
      .then((data) => {
        const all = [data.loginEmail, ...(data.shipmentEmails ?? [])].filter(Boolean);
        setEmails(all);
        setSelectedEmail(all[0] ?? user.email);
      })
      .catch(() => {
        setEmails([user.email]);
        setSelectedEmail(user.email);
      });
  }, [user]);

  // Drop cart voucher metas whose reservation no longer exists on the server
  useEffect(() => {
    if (!user) return;
    const applied = cart.items.filter((i) => i.voucher && i.product_id);
    if (applied.length === 0) return;
    getMyVouchers()
      .then((data) => {
        const pvs = (data?.vouchers ?? []) as PurchasedVoucher[];
        applied.forEach((i) => {
          const pv = pvs.find((p) => p._id === i.voucher!.voucherId);
          const entry = pv ? voucherAppliedEntry(pv, i.product_id!, i.slug) : undefined;
          if (!entry || entry.status !== "reserved") cart.removeVoucher(i.slug);
        });
      })
      .catch(() => {});
  }, [user]);

  // Abandoned checkout — release any reserved voucher uses automatically.
  // Guarded against React StrictMode's instant dev remount.
  useEffect(() => {
    mountedAtRef.current = Date.now();
    return () => {
      if (placedRef.current) return;
      if (Date.now() - mountedAtRef.current < 5000) return;
      releaseCartVoucherReservations();
    };
  }, []);

  const totals = cartTotals(items, deliveryFee, user);
  const set = (key: keyof ShipmentForm) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  function pickCity(name: string, lat?: number, lng?: number) {
    setForm((f) => ({
      ...f,
      courierCity: name,
      latitude: lat ?? f.latitude,
      longitude: lng ?? f.longitude,
    }));
  }

  function showConfirmed(order: any) {
    const orderId = order?._id ?? "";
    const orderNum = orderId
      ? `KFY-${String(orderId).slice(-6).toUpperCase()}`
      : "KFY-000000";
    setConfirmed({ order_number: orderNum, total: order?.totalAmount ?? 0 });
  }

  async function placeOrder() {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Full name");
    if (!form.phone.trim()) missing.push("Phone number");
    if (!form.address.trim()) missing.push("Address");
    if (!form.courierCity.trim()) missing.push("Courier city");
    if (!selectedEmail) missing.push("Confirmation email");

    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    // Heal missing/stale product ids and refresh prices before ordering
    await refreshCartPrices();

    // Validate stock before placing order
    const stockCheck = await validateCartStock();
    if (!stockCheck.valid) {
      const oos = stockCheck.warnings.filter((w) => w.type === "unavailable").map((w) => w.name);
      const insufficient = stockCheck.warnings.filter((w) => w.type === "insufficient").map((w) => w.name);
      const msgs: string[] = [];
      if (oos.length) msgs.push(`${oos.join(", ")} ${oos.length === 1 ? "is" : "are"} out of stock`);
      if (insufficient.length) msgs.push(`Not enough stock for ${insufficient.join(", ")}`);
      toast.error(msgs.join(". ") + ". Remove these items from your bag and try again.");
      return;
    }

    setBusy(true);
    try {
      const data = await api.post<{ success: boolean; order: any; message?: string; emailSent?: boolean }>(
        "/orders",
        {
          clientRequestId: requestIdRef.current!,
          items: cart.items.map((i) => ({
            productId: i.product_id,
            slug: i.slug,
            quantity: i.qty,
            variation: i.variation,
          })),
          shippingDetails: {
            name: form.name.trim(),
            address: form.address.trim(),
            shpType: form.shpType,
            courierCompany: form.courierCompany,
            courierCity: form.courierCity.trim(),
            phoneNumber: form.phone.trim(),
            phoneNumber2: form.phone2.trim(),
            shipping: "cod",
            orderConEmail: selectedEmail,
            sellPrice: totals.total,
            businessProfiles: 1,
            latitude: form.latitude,
            longitude: form.longitude,
          },
        },
      );

      placedRef.current = true;
      cart.clear();
      showConfirmed(data.order);
      if (data.emailSent === false) {
        toast.success("Order placed successfully.");
        toast.error(data.message ?? "We couldn't send the confirmation email. Please contact support.");
      } else {
        toast.success(data.message ?? "Order placed! Check your email to confirm.");
      }
      toast.info("Loyalty points will be awarded after order confirmation.");
    } catch (e: any) {
      // Never release reservations on a network error, timeout or lost
      // response — ask the backend first whether the order was created.
      let recovered = false;
      try {
        const existing = await findOrderByClientRequest(requestIdRef.current!);
        if (existing) {
          placedRef.current = true;
          cart.clear();
          showConfirmed(existing);
          toast.success("Order placed! Check your email to confirm.");
          toast.info("Loyalty points will be awarded after order confirmation.");
          recovered = true;
        }
      } catch {
        // The check itself failed (still offline) — keep the cart and its
        // voucher reservations intact. The retry is idempotent, and stale
        // reservations are swept automatically if the user never returns.
      }
      if (!recovered) {
        // Backend confirmed no order was created — release the reservations.
        releaseCartVoucherReservations();
        toast.error(e?.message ?? "Failed to place order.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <PageShell>
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-10 pb-20 space-y-6" aria-hidden>
          <Skeleton className="h-8 w-40" />
          <div className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-4 border border-border rounded-2xl p-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (confirmed) return <Confirmed order={confirmed} email={user?.email ?? ""} />;

  return (
    <PageShell>
      <section className="bg-coal text-bone min-h-screen">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 pt-10 pb-20">
          {/* Back */}
          <div className="mb-8">
            <Link
              to="/cart"
              className="inline-flex items-center gap-2 eyebrow text-bone/50 hover:text-bone transition text-xs"
            >
              <ArrowLeft className="size-4" strokeWidth={1.5} /> Back to cart
            </Link>
          </div>

          <div className="grid lg:grid-cols-12 gap-12 items-start">
            {/* ── Left: Shipment form ── */}
            <div className="lg:col-span-7 space-y-10">
              <div>
                <p className="eyebrow text-bone/40 mb-2">§ Chapter 01</p>
                <h1 className="font-display italic text-5xl lg:text-7xl leading-[0.9]">
                  Shipment<span className="text-brass">.</span>
                </h1>
              </div>

              {/* ── Confirmation email ── */}
              <div className="space-y-3">
                <p className="eyebrow text-bone/40 text-xs">§ Confirmation email</p>
                <p className="text-bone/50 text-xs">
                  Order confirmation link will be sent here. You must click it within 24 hours.
                </p>
                <div className="space-y-2">
                  {emails.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setSelectedEmail(e)}
                      className={`w-full flex items-center gap-3 px-4 py-3 border text-sm text-left transition ${
                        selectedEmail === e
                          ? "border-brass bg-brass/10 text-bone"
                          : "border-bone/20 hover:border-bone/40 text-bone/70"
                      }`}
                    >
                      <span
                        className={`size-4 rounded-full border-2 grid place-items-center flex-shrink-0 transition ${
                          selectedEmail === e ? "border-brass" : "border-bone/30"
                        }`}
                      >
                        {selectedEmail === e && (
                          <span className="size-2 rounded-full bg-brass" />
                        )}
                      </span>
                      <span className="flex-1 truncate">{e}</span>
                      {e === user.email && (
                        <span className="eyebrow text-bone/40 text-[10px] shrink-0">Login</span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 border border-dashed border-bone/25 text-bone/50 hover:text-bone hover:border-bone/50 text-sm transition"
                  >
                    <Plus className="size-4" strokeWidth={1.5} />
                    Use another email
                  </button>
                </div>
              </div>

              <div className="h-px bg-bone/10" />

              {/* ── Contact info ── */}
              <div className="space-y-4">
                <p className="eyebrow text-bone/40 text-xs">§ {t("co.contact")}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label={t("co.name")} required>
                    <input
                      value={form.name}
                      onChange={(e) => set("name")(e.target.value)}
                      placeholder="Ali Khan"
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t("co.phone")} required>
                    <input
                      value={form.phone}
                      onChange={(e) => set("phone")(formatPhonePK(e.target.value))}
                      placeholder="03XX XXXXXXX"
                      type="tel"
                      inputMode="tel"
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t("co.phone2")}>
                    <input
                      value={form.phone2}
                      onChange={(e) => set("phone2")(formatPhonePK(e.target.value))}
                      placeholder="03XX XXXXXXX"
                      type="tel"
                      inputMode="tel"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              <div className="h-px bg-bone/10" />

              {/* ── Delivery address ── */}
              <div className="space-y-4">
                <p className="eyebrow text-bone/40 text-xs">§ {t("co.address")}</p>
                <Field label={t("co.addressFull")} required>
                  <textarea
                    value={form.address}
                    onChange={(e) => set("address")(e.target.value)}
                    placeholder={t("co.addressPh")}
                    rows={3}
                    className="w-full px-4 py-3 bg-bone/5 border border-bone/20 text-bone outline-none focus:border-brass text-sm transition placeholder:text-bone/30 resize-none"
                  />
                </Field>
                <Field label={t("co.city")} required>
                  <AddressAutocomplete
                    value={form.courierCity}
                    onChange={(v: string) => set("courierCity")(v)}
                    onSelect={(item: GeocodingResult) => {
                      set("courierCity")(item.city || item.label.split(",")[0].trim());
                      if (item.lat && item.lng) {
                        setForm((f) => ({ ...f, latitude: item.lat, longitude: item.lng }));
                      }
                    }}
                    placeholder={t("co.cityPh")}
                    required
                    dark
                    className={inputCls}
                  />
                </Field>
                {/* Popular cities quick-pick */}
                <div className="space-y-2">
                  <p className="eyebrow text-bone/40 text-[10px]">{t("co.popular")}</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_CITIES.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => pickCity(c.name, c.lat, c.lng)}
                        className={`px-3 py-1.5 text-xs border transition ${
                          form.courierCity === c.name
                            ? "border-brass bg-brass/15 text-bone"
                            : "border-bone/20 text-bone/60 hover:border-bone/50 hover:text-bone"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-px bg-bone/10" />

              {/* ── Pin Location ── */}
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
              />

               <div className="h-px bg-bone/10" />
             </div>

            {/* ── Right: Order summary ── */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-8">
              {/* Items */}
              <div className="border border-bone/15 p-6 space-y-4">
                <p className="eyebrow text-bone/40 text-xs">§ {t("co.summary")}</p>
                <ul className="space-y-3">
                  {items.map((i) => (
                    <li key={i.slug} className="flex gap-3 items-start">
                      <div className="size-14 flex-shrink-0 bg-bone/10 overflow-hidden">
                        {i.image && (
                          <img
                            src={i.image}
                            alt={i.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">{i.name}</p>
                        {i.variation && (
                          <p className="text-xs text-bone/50 mt-0.5">
                            Variation: <span className="text-bone/75">{i.variation}</span>
                          </p>
                        )}
                        <p className="text-xs text-bone/50 mt-0.5">Qty {i.qty}</p>
                      </div>
                      <span className="text-sm text-bone/80 shrink-0 font-medium">
                        Rs {(displayUnitPrice(i, user) * i.qty).toLocaleString("en-PK")}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Totals */}
                <div className="border-t border-bone/15 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-bone/60">
                    <span>Subtotal</span>
                    <span>Rs {totals.subtotal.toLocaleString("en-PK")}</span>
                  </div>
                  <div className="flex justify-between text-bone/60">
                    <span>Shipping</span>
                    <span>Rs {totals.shipping.toLocaleString("en-PK")}</span>
                  </div>
                  <p className="text-xs text-bone/50">Cheapest Delivery in Pakistan</p>
                  <div className="flex justify-between font-display font-bold text-base pt-2 border-t border-bone/15 mt-2">
                    <span>Total</span>
                    <span>Rs {totals.total.toLocaleString("en-PK")}</span>
                  </div>
                </div>
              </div>

              {/* Payment — COD + Online */}
              <div className="border border-bone/15 p-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 border border-bone/20 grid place-items-center shrink-0">
                    <span className="eyebrow text-[10px] text-bone/60">COD</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("co.codTitle")}</p>
                    <p className="text-xs text-bone/50">{t("co.codBody")}</p>
                  </div>
                </div>
                <p className="mt-3 pt-3 border-t border-bone/10 text-[11px] leading-relaxed text-bone/55">
                  {t("co.codSafe")}
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={placeOrder}
                disabled={busy || items.length === 0}
                className="w-full h-14 bg-brass text-coal eyebrow flex items-center justify-center gap-3 hover:bg-bone transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Check className="size-5" strokeWidth={2} />
                )}
                {busy ? t("co.placing") : t("co.placeOrder")}
              </button>
              <p className="text-xs text-bone/40 text-center leading-relaxed">
                {t("co.confirmHint", { email: selectedEmail || t("co.youremail") })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OTP Modal */}
      {showOtpModal && (
        <OtpModal
          userName={form.name || user.name || "Customer"}
          onClose={() => setShowOtpModal(false)}
          onVerified={(verifiedEmail) => {
            setEmails((prev) =>
              prev.includes(verifiedEmail) ? prev : [...prev, verifiedEmail],
            );
            setSelectedEmail(verifiedEmail);
            setShowOtpModal(false);
          }}
        />
      )}
    </PageShell>
  );
}
