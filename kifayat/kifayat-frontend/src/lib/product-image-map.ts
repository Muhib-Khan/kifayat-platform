import headphones from "@/assets/p-headphones.jpg";
import watch from "@/assets/p-watch.jpg";
import sneakers from "@/assets/p-sneakers.jpg";
import serum from "@/assets/p-serum.jpg";
import elec from "@/assets/cat-electronics.jpg";
import fashion from "@/assets/cat-fashion.jpg";
import home from "@/assets/cat-home.jpg";
import beauty from "@/assets/cat-beauty.jpg";

// Map seeded product slugs / category slugs / public paths to bundled assets
// so the database-driven catalogue renders crisp images even though the
// `image_url` column may only store a public path.
const map: Record<string, string> = {
  // product slugs
  "wireless-over-ear-headphones": headphones,
  "classic-steel-smartwatch": watch,
  "minimal-white-sneakers": sneakers,
  "vitamin-c-glow-serum-30ml": serum,
  "fast-charging-usb-c-cable-2m": elec,
  "ceramic-mug-set-of-4": home,
  "premium-cotton-crew-tee": fashion,
  "aromatic-hair-oil-100ml": beauty,
  // category slugs
  electronics: elec,
  fashion,
  "home-kitchen": home,
  beauty,
  sports: elec,
  toys: fashion,
  // public paths (whatever the DB stored)
  "/p-headphones.jpg": headphones,
  "/p-watch.jpg": watch,
  "/p-sneakers.jpg": sneakers,
  "/p-serum.jpg": serum,
  "/cat-electronics.jpg": elec,
  "/cat-fashion.jpg": fashion,
  "/cat-home.jpg": home,
  "/cat-beauty.jpg": beauty,
};

// Vercel Image Optimization endpoint — resizes + converts remote images to
// WebP on the edge, then caches them on Vercel's CDN (see `images` in vercel.json).
const OPT_BASE = "/_vercel/image";

export function optImage(url: string, w: number, q = 75): string {
  // Only remote images need optimizing; bundled assets are already small.
  if (!/^https?:\/\//.test(url)) return url;
  // The /_vercel/image endpoint only exists on Vercel's infrastructure.
  // In local dev (and any non-Vercel host) it would 404 every image, so
  // serve the raw CDN URL and let the optimizer handle it in production.
  if (import.meta.env.DEV) return url;
  return `${OPT_BASE}?url=${encodeURIComponent(url)}&w=${w}&q=${q}`;
}

/** Only advertise real resized candidates; local assets and dev URLs stay intact.
 * Widths match the existing Vercel image allowlist. Quality stays at 75. */
export function responsiveImageSet(url: string, widths = [600, 900, 1200, 1500]): string | undefined {
  if (import.meta.env.DEV || !/^https?:\/\//.test(url)) return undefined;
  return widths.map((width) => `${optImage(url, width)} ${width}w`).join(", ");
}

// A hidden responsive image gets an inline placeholder, not a second download.
export const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export function resolveImage(
  slugOrUrl: string | null | undefined,
  fallbackKey?: string,
  w?: number
): string {
  if (!slugOrUrl) return (fallbackKey && map[fallbackKey]) || elec;
  if (map[slugOrUrl]) return map[slugOrUrl];
  // already a full URL (http/https) — pass through, optionally optimized
  if (/^https?:\/\//.test(slugOrUrl)) return w ? optImage(slugOrUrl, w) : slugOrUrl;
  return (fallbackKey && map[fallbackKey]) || elec;
}
