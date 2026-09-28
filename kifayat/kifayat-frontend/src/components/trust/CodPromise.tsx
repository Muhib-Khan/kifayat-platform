import { Banknote, ShieldCheck, Smartphone, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * COD-first trust block for decision points (PDP buybox, cart, checkout).
 * Turns "COD" into the core reassurance: no advance payment, pay in cash
 * or online via courier after checking the parcel.
 */
export function CodPromise() {
  const t = useT();
  const items = [
    { Icon: Banknote, title: t("cod.payOnArrival"), body: t("cod.noAdvance") },
    { Icon: ShieldCheck, title: t("cod.checkFirst"), body: t("cod.checkBody") },
    { Icon: Smartphone, title: t("cod.noOnline"), body: t("cod.noOnlineBody") },
    { Icon: RotateCcw, title: t("trust.returns"), body: t("cod.returnsBody") },
  ];
  return (
    <div className="border border-coal/10 bg-card p-4">
      <p className="eyebrow text-[10px] text-brass mb-3 flex items-center gap-2">
        <Banknote className="size-3.5" strokeWidth={1.5} />
        {t("cod.title")}
      </p>
      <ul className="space-y-2.5">
        {items.map(({ Icon, title, body }) => (
          <li key={title} className="flex items-start gap-2.5">
            <Icon className="size-3.5 text-brass shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-coal leading-tight">{title}</p>
              <p className="text-[11px] text-coal/55 mt-0.5 leading-snug">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
