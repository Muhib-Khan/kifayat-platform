// ─── PKR formatting ────────────────────────────────────────────────────────────
export function fmtPKR(n: number | string | null | undefined, maxFrac = 0): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "Rs 0";
  return (
    "Rs " +
    num.toLocaleString("en-PK", {
      maximumFractionDigits: maxFrac,
      minimumFractionDigits: 0,
    })
  );
}

// ─── Pakistani phone formatting ────────────────────────────────────────────────
// Normalises a phone into the local `03XX` form (drops +92).
export function toLocalPhone(phone: string): string {
  let p = (phone || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+92")) p = "0" + p.slice(3);
  else if (p.startsWith("92") && p.length >= 11) p = "0" + p.slice(2);
  return p;
}

// Formats as `03XX-XXXXXXX` while typing. Keeps digits only.
export function formatPhonePK(value: string): string {
  const p = toLocalPhone(value).replace(/^0*/, "0").slice(0, 11);
  if (p.length <= 4) return p;
  if (p.length <= 7) return `${p.slice(0, 4)}-${p.slice(4)}`;
  return `${p.slice(0, 4)}-${p.slice(4, 7)}-${p.slice(7)}`;
}

// ── Date / time ────────────────────────────────────────────────────────────────
export function fmtDatePK(input: string | Date | number): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtTimePK(input: string | Date | number): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fmtDateTimePK(input: string | Date | number): string {
  return `${fmtDatePK(input)} · ${fmtTimePK(input)}`;
}