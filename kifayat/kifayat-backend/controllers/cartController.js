const Cart = require("../models/Cart");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const { productAvailability } = require("./productController");

const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart) {
      return res.status(200).json({ success: true, items: [] });
    }
    const validItems = (cart.items || []).filter((item) => item.product);
    return res.status(200).json({ success: true, items: validItems });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch cart." });
  }
};

const saveCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Items must be an array." });
    }

    const productIds = items.filter((i) => i._id).map((i) => i._id);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    for (const item of items) {
      if (!item._id) continue;
      const product = productMap[item._id];
      if (!product || product.stock <= 0) {
        const name = product?.name || "Unknown product";
        return res.status(400).json({ success: false, message: `${name} is out of stock and cannot be added to cart.` });
      }
    }

    const cartItems = items
      .filter((i) => {
        if (!i._id) return false;
        const qty = Math.floor(Number(i.quantity));
        return qty > 0 && qty <= 999;
      })
      .map((i) => ({
        product: i._id,
        quantity: Math.floor(Number(i.quantity)),
      }));

    if (cartItems.length === 0) {
      await Cart.findOneAndDelete({ user: req.user._id });
      return res.status(200).json({ success: true, message: "Cart cleared." });
    }

    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: cartItems },
      { upsert: true, new: true },
    );

    return res.status(200).json({ success: true, message: "Cart saved." });
  } catch (err) {
    console.error("saveCart error:", err);
    return res.status(500).json({ success: false, message: "Failed to save cart." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cart/validate  (authenticated user — validate cart stock)
// Body: { items: [{ productId, slug, quantity }] }
// Resolves products by _id (preferred) or slug, so cart rows with missing or
// stale product ids still validate. Returns the resolved _id so the frontend
// can heal stored cart items. Availability is variation-aware (same source of
// truth as every customer-facing product response).
// ─────────────────────────────────────────────────────────────────────────────
const validateCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({ success: true, validItems: [], warnings: [] });
    }

    const idList = [];
    const slugList = [];
    const entries = items.map((i) => {
      const pid = i.productId;
      const validId = typeof pid === "string" && mongoose.isValidObjectId(pid);
      // Ids can be stale after a product re-import — always carry the slug as
      // the resilience net so items keep resolving.
      if (validId) idList.push(pid);
      if (typeof i.slug === "string" && i.slug) slugList.push(i.slug);
      return {
        productId: pid ?? null,
        slug: i.slug ?? null,
        quantity: Number(i.quantity) || 0,
      };
    });

    const found = [];
    if (idList.length) found.push(...(await Product.find({ _id: { $in: idList } }).lean()));
    if (slugList.length) found.push(...(await Product.find({ slug: { $in: slugList } }).lean()));

    const byId = new Map();
    const bySlug = new Map();
    found.forEach((p) => {
      byId.set(p._id.toString(), p);
      if (p.slug) bySlug.set(p.slug, p);
    });

    const warnings = [];
    const validItems = [];

    for (const entry of entries) {
      const product =
        (entry.productId && byId.get(entry.productId)) ||
        (entry.slug && bySlug.get(entry.slug)) ||
        null;

      if (!product) {
        warnings.push({
          productId: entry.productId ?? entry.slug ?? null,
          name: "Unknown Product",
          available: 0,
          requested: entry.quantity,
          type: "unavailable",
        });
        continue;
      }

      const { inStock, available } = productAvailability(product);
      if (!inStock) {
        warnings.push({
          productId: entry.productId ?? product.slug ?? null,
          name: product.name,
          available: 0,
          requested: entry.quantity,
          type: "unavailable",
        });
      } else if (available < entry.quantity) {
        warnings.push({
          productId: entry.productId ?? product.slug ?? null,
          name: product.name,
          available,
          requested: entry.quantity,
          type: "insufficient",
        });
      }

      validItems.push({
        productId: product._id.toString(),
        slug: product.slug ?? entry.slug,
        name: product.name,
        available,
        inStock,
        currentPrice: product.retailPrice ?? 0,
        lowPrice: product.lowPrice === true,
      });
    }

    return res.status(200).json({ success: true, validItems, warnings });
  } catch (err) {
    console.error("validateCart error:", err);
    return res.status(500).json({ success: false, message: "Failed to validate cart." });
  }
};

module.exports = { getCart, saveCart, validateCart };
