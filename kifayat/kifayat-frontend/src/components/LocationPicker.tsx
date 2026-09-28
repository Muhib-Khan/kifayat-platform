import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Loader2 } from "lucide-react";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

export default function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  const center: [number, number] =
    latitude && longitude ? [latitude, longitude] : [30.3753, 69.3451];
  const zoom = latitude && longitude ? 15 : 5;

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then(async ({ default: L }) => {
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default as string;
      const iconRetinaUrl = (await import("leaflet/dist/images/marker-icon-2x.png")).default as string;
      const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default as string;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href='https://openstreetmap.org/copyright'>OpenStreetMap</a>",
        maxZoom: 19,
      }).addTo(map);
      mapInstance.current = map;

      const marker = L.marker(center, { draggable: true }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapInstance.current && markerRef.current && latitude && longitude) {
      mapInstance.current.setView([latitude, longitude], 16);
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  const locateMe = async () => {
    if (!navigator.geolocation) {
      setLocError("Type your city name in the field above, select from suggestions, then drag the pin.");
      return;
    }
    setLocating(true);
    setLocError("");

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout")), 8000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timer); resolve(p); },
          (e) => { clearTimeout(timer); reject(e); },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 },
        );
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      if (mapInstance.current && markerRef.current) {
        mapInstance.current.setView([lat, lng], 17);
        markerRef.current.setLatLng([lat, lng]);
      }
      onChange(lat, lng);
    } catch {
      setLocError("Browser location unavailable. Type your city name above, select from suggestions, then drag the pin to your exact house.");
    }
    setLocating(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="eyebrow text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-3.5" /> Pin Location
        </label>
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="flex items-center gap-1.5 text-xs font-bold text-brass hover:text-brass/80 disabled:opacity-50 transition-colors"
        >
          {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
          {locating ? "Locating…" : "Auto-detect"}
        </button>
      </div>

      <div
        ref={mapRef}
        className="w-full h-52 rounded-xl border border-border overflow-hidden z-0"
      />

      {latitude && longitude ? (
        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <Crosshair className="size-3" /> Drag the pin to your exact house
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <MapPin className="size-3" /> Type your city above, select from suggestions, then drag the pin
        </p>
      )}

      {locError && (
        <p className="text-xs text-amber-500 font-medium">{locError}</p>
      )}
    </div>
  );
}
