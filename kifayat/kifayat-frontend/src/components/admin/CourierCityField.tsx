import { POPULAR_CITIES } from "@/services/geocoding";
import { MapPin } from "lucide-react";

const CITY_DATALIST_ID = "kifayat-courier-cities";

export function CourierCityField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5 w-full sm:w-56">
      <label
        htmlFor="courier-city-input"
        className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
      >
        <MapPin className="size-3.5" />
        Courier City
      </label>
      <input
        id="courier-city-input"
        list={CITY_DATALIST_ID}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Karachi, Charsadda…"
        className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg outline-none focus:border-brass transition placeholder:text-muted-foreground/60"
      />
      <datalist id={CITY_DATALIST_ID}>
        {POPULAR_CITIES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <p className="text-[11px] text-muted-foreground/70 leading-snug">
        Written on every CSV row as the courier city · Provider: Trax
      </p>
    </div>
  );
}