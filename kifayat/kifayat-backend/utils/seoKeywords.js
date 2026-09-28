// Deterministic per-product SEO keyword generation — no AI dependency.
//
// Used by the HHC sync (Grand Sync / quick fetch), CSV import, and manual
// product creation so EVERY product gets searchable keywords automatically.
// The admin edit form and the AI "SEO Booster" can later override/enhance.

/**
 * Generate a small set of searchable keyword phrases from a product's
 * name + category. Lowercased, deduped, capped at 10.
 *
 * Examples:
 *   ("Adjustable Hand Gripper 5-60kg", "Fitness")
 *     -> ["adjustable hand gripper 5-60kg", "adjustable hand gripper 5-60kg Pakistan",
 *         "fitness Pakistan", "best fitness", "best adjustable hand gripper 5-60kg",
 *         "buy adjustable hand gripper 5-60kg"]
 */
function generateKeywords(name, category) {
  const kws = new Set();
  const n = (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const c = (category || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!n) return [];

  // 1. Full product name (lowercased)
  kws.add(n);

  // 2. Core product type — first 3 meaningful words (skip size/weight tokens
  //    like "5-60kg" that are noise as a keyword on their own)
  const coreWords = n
    .split(/\s+/)
    .filter((w) => !/^\d/.test(w) && !/^\d+-\d+/.test(w));
  if (coreWords.length > 3) kws.add(coreWords.slice(0, 3).join(" "));

  // 3. Name + "Pakistan" (the primary geo-intent signal)
  kws.add(n + " Pakistan");

  // 4. Category-based
  if (c && c !== "uncategorized") {
    kws.add(c + " Pakistan");
    kws.add("best " + c);
  }

  // 5. "best" prefix (a top buyer-intent phrase in Pakistan)
  if (!n.startsWith("best ")) kws.add("best " + n);

  // 6. "buy" prefix
  kws.add("buy " + n);

  return [...kws].filter((k) => k.trim().length > 1).slice(0, 10);
}

module.exports = { generateKeywords };