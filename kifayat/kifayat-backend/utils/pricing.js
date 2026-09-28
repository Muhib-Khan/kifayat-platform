// Low-price rule: retail < 500 => flat +270, no % margin
const LOW_PRICE_THRESHOLD = 500;
const LOW_PRICE_FLAT_ADD = 270;
// Universal add-on applied to every product AFTER the low-price/% classification
const UNIVERSAL_ADD = 150;

// wholesale must be > 0; returns { retail, lowPrice }
// - if lowPrice flag is set (persisted): always wholesale + 270
// - else compute % markup; if result < 500 -> flat +270 and mark lowPrice
// - classification happens on the pre-+100 value; UNIVERSAL_ADD is applied last
function computeRetail(wholesale, pct, lowPrice = false) {
  if (!wholesale || wholesale <= 0) return null;
  let retail;
  let isLow;
  if (lowPrice) {
    retail = wholesale + LOW_PRICE_FLAT_ADD;
    isLow = true;
  } else {
    const markedUp = Math.round(wholesale * (1 + pct / 100));
    if (markedUp < LOW_PRICE_THRESHOLD) {
      retail = wholesale + LOW_PRICE_FLAT_ADD;
      isLow = true;
    } else {
      retail = markedUp;
      isLow = false;
    }
  }
  return { retail: retail + UNIVERSAL_ADD, lowPrice: isLow };
}

// PRIORITY: price range → category → global. Range overrides everything.
// In-range products use a PURE percentage (retail = wholesale * (1 + pct/100))
// — NO universal add, NO low-price flat rule — because the product spec
// requires exactly: original 100 + 20% = 120. Out-of-range products keep the
// existing computeRetail behavior (category % → global %), fully unchanged.
function resolvePctFromRules(wholesale, category, rules) {
  const { priceRanges = [], categoryPricing = {}, globalPricing = null } = rules || {};
  const hasGlobalPct = typeof globalPricing === "number" && globalPricing >= 0;

  if (Array.isArray(priceRanges) && priceRanges.length > 0) {
    const match = priceRanges.find(
      (r) => wholesale >= Number(r.minPrice) && wholesale <= Number(r.maxPrice)
    );
    if (match && typeof match.profitMargin === "number" && match.profitMargin >= 0) {
      // Price range found: add its margin to global pricing if global exists
      const totalPct = hasGlobalPct ? match.profitMargin + globalPricing : match.profitMargin;
      return { pct: totalPct, fromRange: true };
    }
  }
  const catPct = category ? categoryPricing[category] : undefined;
  if (typeof catPct === "number" && catPct >= 0) return { pct: catPct, fromRange: false };
  if (typeof globalPricing === "number" && globalPricing >= 0) return { pct: globalPricing, fromRange: false };
  return null;
}

// Returns { retail, lowPrice } or null (when no rule applies / wholesale invalid).
function priceProductFromRules(wholesale, category, lowPrice, rules) {
  if (!wholesale || wholesale <= 0) return null;
  const resolved = resolvePctFromRules(wholesale, category, rules);
  if (!resolved) return null;
  if (resolved.fromRange) {
    const retail = Math.round(wholesale * (1 + resolved.pct / 100));
    if (!Number.isFinite(retail) || retail < 0) return null;
    return { retail, lowPrice: false };
  }
  const priced = computeRetail(wholesale, resolved.pct, lowPrice);
  if (!priced || !Number.isFinite(priced.retail) || priced.retail < 0) return null;
  return priced;
}

// ── Pricing rules cache ──────────────────────────────────────────────────────
// loadPricingRules() runs two DB reads and is called on every product detail
// page. Pricing changes are rare and always flow through scheduleReprice(),
// which clears this cache, so a short TTL removes those reads from the hot path.
let pricingRulesCache = null;
let pricingRulesCacheAt = 0;
const PRICING_RULES_TTL = 60_000;

async function loadPricingRules() {
  if (pricingRulesCache && Date.now() - pricingRulesCacheAt < PRICING_RULES_TTL) {
    return pricingRulesCache;
  }
  const [settings, priceRanges] = await Promise.all([
    require("../models/Settings").findOne({}).lean(),
    require("../models/PriceRange").find().sort({ createdAt: 1 }).lean(),
  ]);
  const categoryPricing = settings?.categoryPricing
    ? (settings.categoryPricing instanceof Map
        ? Object.fromEntries(settings.categoryPricing)
        : settings.categoryPricing)
    : {};
  const rules = {
    categoryPricing,
    globalPricing: settings?.globalPricing ?? null,
    priceRanges,
  };
  pricingRulesCache = rules;
  pricingRulesCacheAt = Date.now();
  return rules;
}

function clearPricingRulesCache() {
  pricingRulesCache = null;
  pricingRulesCacheAt = 0;
}

// Bulk re-prices every product with wholesalePrice > 0 using the rule priority.
// Returns number of changed products. Cursor-based + chunked so the event loop
// stays responsive and the whole catalog is never held in memory at once.
async function repriceAllProducts() {
  clearPricingRulesCache();
  const rules = await loadPricingRules();
  const CHUNK = 500;
  let changed = 0;
  let ops = [];
  const cursor = require("../models/Product")
    .find({ wholesalePrice: { $gt: 0 } })
    .select("_id wholesalePrice lowPrice category retailPrice")
    .lean()
    .cursor();
  await cursor.eachAsync(
    async (product) => {
      const priced = priceProductFromRules(product.wholesalePrice, product.category, product.lowPrice === true, rules);
      if (!priced) return;
      if (!Number.isFinite(priced.retail) || priced.retail < 0) return;
      if (priced.retail !== product.retailPrice || priced.lowPrice !== (product.lowPrice === true)) {
        ops.push({ updateOne: { filter: { _id: product._id }, update: { $set: { retailPrice: priced.retail, lowPrice: priced.lowPrice } } } });
      }
      if (ops.length >= CHUNK) {
        await require("../models/Product").bulkWrite(ops);
        changed += ops.length;
        ops = [];
      }
    },
    { parallel: 1 }
  );
  if (ops.length) { await require("../models/Product").bulkWrite(ops); changed += ops.length; }
  // Retail prices changed — drop the public catalogue cache too (lazy require
  // avoids a require cycle between productController and utils/pricing).
  try {
    require("../controllers/productController").invalidateProductListCache();
  } catch { /* module not loaded yet / already available — no-op */ }
  return changed;
}

// Background reprice: single-flight + debounced so rapid range save/delete
// triggers never stack or block the request handler.
let _repriceRunning = false;
let _repricePending = false;

async function _runRepriceLoop() {
  if (_repriceRunning) { _repricePending = true; return; }
  _repriceRunning = true;
  do {
    _repricePending = false;
    try {
      await repriceAllProducts();
    } catch (err) {
      console.error("[pricing] background reprice failed:", err);
    }
  } while (_repricePending);
  _repriceRunning = false;
}

function scheduleReprice() {
  setImmediate(_runRepriceLoop);
}

module.exports = {
  computeRetail,
  resolvePctFromRules,
  priceProductFromRules,
  loadPricingRules,
  clearPricingRulesCache,
  repriceAllProducts,
  scheduleReprice,
  LOW_PRICE_THRESHOLD,
  LOW_PRICE_FLAT_ADD,
  UNIVERSAL_ADD,
};
