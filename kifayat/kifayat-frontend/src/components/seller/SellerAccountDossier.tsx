import {
  AtSign,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  ExternalLink,
  Fingerprint,
  Mail,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { SellerAccount, SellerAnalytics } from "@/lib/seller.functions";

function dateLabel(value: string | null, withTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-PK", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] eyebrow text-coal/45">
        {Icon && <Icon className="size-3.5 text-brass" strokeWidth={1.7} />}
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-coal/85">{value || "Not provided"}</p>
    </div>
  );
}

export function SellerAccountDossier({
  seller,
  analytics,
  admin = false,
}: {
  seller: SellerAccount;
  analytics: SellerAnalytics;
  admin?: boolean;
}) {
  const statusTone = seller.accountStatus === "active"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : seller.accountStatus === "dormant"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <section className="border border-coal/10 bg-paper overflow-hidden" aria-label="Seller account information">
      <div className="bg-coal text-bone p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-14 sm:size-16 rounded-2xl bg-brass text-coal grid place-items-center font-display text-2xl shrink-0">
              {(seller.storeName || seller.name || "S").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="eyebrow text-brass text-[10px] mb-2">{admin ? "Admin seller dossier" : "Your account dossier"}</p>
              <h2 className="font-display italic text-2xl sm:text-3xl truncate">{seller.storeName}</h2>
              <p className="mt-2 text-sm text-bone/65 truncate">{seller.name} · {seller.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] eyebrow">
            <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 ${statusTone}`}>
              <span className="size-1.5 rounded-full bg-current" />
              {statusLabel(seller.accountStatus)}
            </span>
            <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 ${seller.isVerified ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-amber-300/30 bg-amber-400/10 text-amber-100"}`}>
              {seller.isVerified ? <CheckCircle2 className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {seller.isVerified ? "Verified account" : "Verification pending"}
            </span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-bone/10 pt-5">
          <div><p className="text-[10px] eyebrow text-bone/45">Seller ID</p><p className="mt-1.5 text-xs font-mono text-bone/80 break-all">{seller.id || "—"}</p></div>
          <div><p className="text-[10px] eyebrow text-bone/45">Store handle</p><p className="mt-1.5 text-xs text-bone/80">/{seller.storeSlug || "—"}</p></div>
          <div><p className="text-[10px] eyebrow text-bone/45">Joined</p><p className="mt-1.5 text-xs text-bone/80">{dateLabel(seller.createdAt)}</p></div>
          <div><p className="text-[10px] eyebrow text-bone/45">Last active</p><p className="mt-1.5 text-xs text-bone/80">{dateLabel(seller.lastActiveAt, true)}</p></div>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid lg:grid-cols-3 gap-7">
          <div>
            <div className="flex items-center gap-2 mb-5"><CircleUserRound className="size-4 text-brass" /><h3 className="font-semibold text-sm">Identity & contact</h3></div>
            <div className="space-y-5">
              <Detail icon={AtSign} label="Account name" value={seller.name} />
              <Detail icon={Mail} label="Login email" value={seller.email} />
              <Detail icon={Phone} label="Phone number" value={seller.phone} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-5"><ShieldCheck className="size-4 text-brass" /><h3 className="font-semibold text-sm">Access & trust</h3></div>
            <div className="space-y-5">
              <Detail icon={Fingerprint} label="Authentication" value={statusLabel(seller.authProvider)} />
              <Detail label="Role" value={statusLabel(seller.role)} />
              <Detail label="Order confirmation email" value={seller.orderConfirmationEmail ? `${seller.orderConfirmationEmail}${seller.orderConfirmationEmailVerified ? " · verified" : " · unverified"}` : "Not configured"} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-5"><Store className="size-4 text-brass" /><h3 className="font-semibold text-sm">Store operations</h3></div>
            <div className="space-y-5">
              <Detail icon={CalendarDays} label="Account age" value={seller.joinedDaysAgo === null ? "Not available" : `${seller.joinedDaysAgo} day${seller.joinedDaysAgo === 1 ? "" : "s"} on Kifayat`} />
              <Detail label="Shipment notifications" value={`${seller.shipmentEmailsCount} recipient${seller.shipmentEmailsCount === 1 ? "" : "s"} configured`} />
              <Detail label="Current account health" value={`${analytics.health.score}/100 · ${analytics.health.label}`} />
            </div>
          </div>
        </div>
        <div className="mt-7 pt-5 border-t border-coal/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-coal/55">Storefront: <span className="font-medium text-coal/80">/seller/{seller.storeSlug}</span></p>
          <a href={`/seller/${seller.storeSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brass-deep hover:text-coal transition-colors">
            Open public store <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}