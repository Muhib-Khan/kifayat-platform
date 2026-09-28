import { Truck, ShieldCheck, Banknote, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Horizontal brass trust strip — same visual language as the header strip
 * (Header.tsx). Used in the cart summary and other decision points.
 */
export function TrustBar({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 eyebrow text-[11px] text-coal/65 ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Truck className="size-3.5 text-brass shrink-0" strokeWidth={1.5} /> {t("trust.delivery")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 text-brass shrink-0" strokeWidth={1.5} /> {t("cod.title")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Banknote className="size-3.5 text-brass shrink-0" strokeWidth={1.5} /> {t("cod.noAdvance")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <RotateCcw className="size-3.5 text-brass shrink-0" strokeWidth={1.5} /> {t("trust.returns")}
      </span>
    </div>
  );
}
