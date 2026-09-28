const Product = require("../models/Product");

// ─────────────────────────────────────────────────────────────────────────────
// HHC export helpers
// Resolves the REAL HHC product ID / variation ID for every ordered line so
// the Main Order CSV (HHC Bulk Order format) always carries HHC identifiers
// instead of local MongoDB ids or SKUs.
// ─────────────────────────────────────────────────────────────────────────────

const isNumericString = (v) => /^\d+$/.test(String(v ?? "").trim());

/** Short human label for an HHC variation — mirrors the frontend helper. */
function variationLabel(v) {
  const name = String(v?.name ?? "").trim();
  if (!name) return "";
  const parts = name.split("|").map((s) => s.trim()).filter(Boolean);
  const last = (parts.length > 1 ? parts[parts.length - 1] : parts[0]) ?? "";
  if (last.length > 0 && last.length <= 60) return last;
  const byDash = name.split(" - ").pop()?.trim();
  if (byDash && byDash.length > 0 && byDash.length <= 60) return byDash;
  return name.length > 60 ? "" : name;
}

/**
 * Find the HHC variation object that matches the label the customer picked.
 * Tries (in order): exact variation id, variation sku, exact variation name,
 * the computed short label, and the "Option N" fallback used by the store.
 * Returns null when the product has no variations OR the customer did not
 * select a variation — the CSV variation field must stay empty then.
 */
function matchVariation(product, label) {
  const variants = Array.isArray(product?.variations)
    ? product.variations.filter((v) => v && typeof v === "object")
    : [];
  if (variants.length === 0) return null;

  const needle = String(label || "").trim();

  if (needle) {
    if (isNumericString(needle)) {
      const byId = variants.find((v) => String(v.id ?? "") === needle);
      if (byId) return byId;
    }
    const nl = needle.toLowerCase();
    const bySku = variants.find((v) => v.sku && String(v.sku).toLowerCase() === nl);
    if (bySku) return bySku;
    const byName = variants.find(
      (v) => String(v.name || "").trim().toLowerCase() === nl,
    );
    if (byName) return byName;
    const byLabel = variants.find(
      (v) => variationLabel(v).toLowerCase() === nl,
    );
    if (byLabel) return byLabel;
    const optionMatch = nl.match(/^option\s+(\d+)$/);
    if (optionMatch) {
      const idx = Number(optionMatch[1]) - 1;
      if (idx >= 0 && idx < variants.length) return variants[idx];
    }
  }
  return null;
}

/**
 * Build the numbered product/variation/qty fields for the HHC export from a
 * list of order/pre-order items. Items may carry the product as an ObjectId
 * or as a populated object (both are handled).
 *
 * Returns:
 *  - productFields  → { product1..N, variation1..N, qty1..N } with the REAL
 *                     HHC product id / HHC variation id in every slot
 *  - productExtras  → { productSku1..N, variationName1..N, productName1..N }
 *                     kept on the record so no variation info is lost
 *  - productSearch  → lowercase search tokens (sku / HHC id / name)
 *  - resolvedItems  → per-line resolution { product, hhcProductId,
 *                     variationId, variationName, sku, name, quantity }
 */
async function buildHhcCSVProductFields(items = []) {
  const list = Array.isArray(items) ? items : [];

  const refs = [];
  for (const item of list) {
    const ref = item?.product?._id || item?.product;
    if (ref) refs.push(ref);
  }

  let productsById = new Map();
  if (refs.length > 0) {
    const docs = await Product.find({ _id: { $in: refs } })
      .select("_id sku name productId imageUrl retailPrice variations")
      .lean();
    productsById = new Map(docs.map((p) => [String(p._id), p]));
  }

  const productFields = {};
  const productExtras = {};
  const productSearch = [];
  const resolvedItems = [];

  list.forEach((item, idx) => {
    const i = idx + 1;
    const ref = item?.product?._id || item?.product;
    const product = ref ? productsById.get(String(ref)) : null;
    const label = String(item?.variation ?? "").trim();
    // Prefer the HHC ids already captured at checkout (if present), then
    // fall back to resolving them from the catalog.
    const capturedPid = item?.productId ? String(item.productId).trim() : "";
    const capturedVid = item?.variationId ? String(item.variationId).trim() : "";
    const variant = capturedVid ? null : matchVariation(product, label);
    const hhcProductId = capturedPid || String(product?.productId ?? "").trim();
    const variationId = capturedVid ||
      (variant && variant.id !== undefined && variant.id !== null
        ? String(variant.id)
        : "");
    const variationName =
      (capturedVid
        ? item?.variationName ||
          (variant?.name) ||
          label
        : variant && variant.name
          ? String(variant.name)
          : label) || "";
    const populatedSku =
      item?.product && typeof item.product === "object" ? item.product.sku : "";
    const sku = String(product?.sku || item?.sku || populatedSku || "").trim();
    const name = String(product?.name || item?.name || "").trim();
    const quantity = Number(item?.quantity) || 0;
    // Sell price for this line: the price the customer actually paid per unit
    // at checkout (voucher-discounted), falling back to the catalog retail.
    const unitPrice = Number(
      item?.price ?? item?.product?.retailPrice ?? product?.retailPrice ?? 0,
    ) || 0;

    productFields[`product${i}`] = hhcProductId;
    productFields[`variation${i}`] = variationId;
    productFields[`qty${i}`] = quantity;

    productExtras[`productSku${i}`] = sku;
    productExtras[`variationName${i}`] = variationName;
    productExtras[`productName${i}`] = name;
    productExtras[`productPrice${i}`] = unitPrice;

    if (sku) productSearch.push(sku.toLowerCase());
    if (hhcProductId) productSearch.push(hhcProductId.toLowerCase());
    if (name) productSearch.push(name.toLowerCase());

    resolvedItems.push({
      product,
      hhcProductId,
      variationId,
      variationName,
      sku,
      name,
      quantity,
      unitPrice,
      label,
      productRef: ref || null,
    });
  });

  return { productFields, productExtras, productSearch, resolvedItems };
}

module.exports = {
  isNumericString,
  variationLabel,
  matchVariation,
  buildHhcCSVProductFields,
};
