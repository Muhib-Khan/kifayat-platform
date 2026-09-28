// Comprehensive Pakistan cities — fallback when Nominatim is unavailable
const PAKISTAN_CITIES = [
  "Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Islamabad",
  "Multan", "Hyderabad", "Gujranwala", "Peshawar", "Quetta",
  "Sialkot", "Bahawalpur", "Sargodha", "Sukkur", "Larkana",
  "Sheikhupura", "Mardan", "Gujrat", "Kasur", "Dera Ghazi Khan",
  "Wah Cantonment", "Sahiwal", "Nawabshah", "Mingora", "Okara",
  "Mirpur Khas", "Chiniot", "Jhelum", "Kamoke", "Burewala",
  "Hafizabad", "Khanewal", "Muzaffargarh", "Khanpur", "Gojra",
  "Dadu", "Bahawalnagar", "Tando Allahyar", "Tando Adam",
  "Jhang", "Daska", "Pakpattan", "Vehari", "Rahim Yar Khan",
  "Abbottabad", "Haripur", "Mansehra", "Kohat", "Bannu",
  "Swat", "Chitral", "Gilgit", "Skardu", "Murree",
  "Nowshera", "Charsadda", "Swabi", "Turbat", "Gwadar",
  "Khuzdar", "Hub", "Jacobabad", "Shikarpur", "Kandhkot",
  "Umarkot", "Thatta", "Badin", "Matiari", "Sanghar",
];

export interface GeocodingResult {
  label: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
}

// Normalize text for fuzzy matching
const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Fuzzy match — returns true if query chars appear in order in target
const fuzzyMatch = (query: string, target: string) => {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return false;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
};

// Local fallback: search Pakistan cities + static results
const localSearch = (query: string): GeocodingResult[] => {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: GeocodingResult[] = [];

  // Match against Pakistan cities
  for (const city of PAKISTAN_CITIES) {
    if (fuzzyMatch(q, city)) {
      results.push({
        label: `${city}, Pakistan`,
        area: "",
        city,
        lat: 0,
        lng: 0,
      });
    }
  }

  // Match against common area/neighborhood patterns
  const areas = [
    "Gulshan-e-Maymar", "Gulshan-e-Iqbal", "Gulistan-e-Jauhar",
    "DHA", "Clifton", "Saddar", "Korangi", "Landhi", "Malir",
    "North Nazimabad", "Nazimabad", "Federal B Area", "Lyari",
    "Orangi Town", "Baldia Town", "Keamari", "Shah Faisal Colony",
    "Model Town", "Garden Town", "Township", "Johar Town",
    "Valencia Town", "Wapda Town", "Ichhra", "Anarkali",
    "Satellite Town", "Cantt", "Phase 1", "Phase 2",
  ];

  for (const area of areas) {
    if (fuzzyMatch(q, area)) {
      results.push({
        label: `${area}, Pakistan`,
        area,
        city: "",
        lat: 0,
        lng: 0,
      });
    }
  }

  return results.slice(0, 8);
};

// ── Popular Pakistani cities (quick-pick chips) ───────────────────────────────
export interface CityQuickPin {
  name: string;
  lat: number;
  lng: number;
}

export const POPULAR_CITIES: CityQuickPin[] = [
  { name: "Karachi",    lat: 24.8607,  lng: 67.0011 },
  { name: "Lahore",     lat: 31.5204,  lng: 74.3587 },
  { name: "Islamabad",  lat: 33.6844,  lng: 73.0479 },
  { name: "Rawalpindi", lat: 33.5651,  lng: 73.0169 },
  { name: "Faisalabad", lat: 31.4504,  lng: 73.1350 },
  { name: "Multan",     lat: 30.1575,  lng: 71.5249 },
  { name: "Peshawar",   lat: 34.0151,  lng: 71.5249 },
  { name: "Quetta",     lat: 30.1798,  lng: 66.9750 },
  { name: "Sialkot",    lat: 32.4945,  lng: 74.5229 },
  { name: "Hyderabad",  lat: 25.3960,  lng: 68.3578 },
];

// ── Nominatim search (primary) ────────────────────────────────────────────

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `${NOMINATIM_URL}?q=${encodeURIComponent(query)},+Pakistan&format=json&limit=6&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "Kifayat/1.0 (customer service)",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return localSearch(query);
    }

    return data.map((item: any) => {
      const addr = item.address || {};
      const parts = [addr.house_number, addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.state].filter(Boolean);
      return {
        label: parts.join(", ") || item.display_name || query,
        area: addr.suburb || addr.neighbourhood || "",
        city: addr.city || addr.town || addr.village || addr.county || "",
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });
  } catch {
    return localSearch(query);
  }
}

// ── Reverse geocode (coords → address) ─────────────────────────────────────

const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `${REVERSE_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "Kifayat/1.0 (customer service)",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.address) return null;

    const addr = data.address;
    const parts: string[] = [];
    if (addr.house_number) parts.push(addr.house_number);
    if (addr.road) parts.push(addr.road);
    if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
    if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
    if (addr.state) parts.push(addr.state);

    return {
      label: parts.join(", ") || data.display_name || "",
      area: addr.suburb || addr.neighbourhood || addr.road || "",
      city: addr.city || addr.town || addr.village || addr.county || "",
      lat,
      lng,
    };
  } catch {
    return null;
  }
}
