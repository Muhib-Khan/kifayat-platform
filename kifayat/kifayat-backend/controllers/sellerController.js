const mongoose = require("mongoose");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const PreOrder = require("../models/PreOrder");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const OrderHistory = require("../models/OrderHistory");

const STORE_SLUG = "faizs-store";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || `product-${Date.now().toString(36)}`;
}

async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    if (!(await Product.exists(query))) return slug;
    slug = `${base}-${suffix}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function publicProduct(product) {
  const p = product.toObject ? product.toObject() : { ...product };
  delete p.wholesalePrice;
  delete p.stock;
  delete p.originalStock;
  delete p.hidden;
  delete p.deleted;
  delete p.deletedAt;
  delete p.seller;
  delete p.rawData;
  delete p.variations;
  delete p.gallery;
  delete p.__v;
  p.inStock = Number(product.stock || 0) > 0;
  return p;
}

function validateProductBody(body, { creating = false } = {}) {
  const name = body?.name;
  if (creating && (typeof name !== "string" || !name.trim())) {
    return "Product name is required.";
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return "Product name cannot be empty.";
  }
  for (const key of ["retailPrice", "stock", "weight"]) {
    if (body?.[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) return `${key} must be a number greater than or equal to 0.`;
    }
  }
  for (const key of ["description", "category", "imageUrl", "videoUrl"]) {
    if (body?.[key] !== undefined && typeof body[key] !== "string") return `${key} must be a string.`;
  }
  return null;
}

function normalizeProductInput(body, existing = {}) {
  const input = {};
  for (const key of ["name", "description", "category", "imageUrl", "videoUrl"]) {
    if (body[key] !== undefined) input[key] = String(body[key]).trim();
  }
  for (const key of ["retailPrice", "stock", "weight"]) {
    if (body[key] !== undefined) input[key] = Number(body[key]);
  }
  if (input.stock !== undefined && existing.stock === undefined) input.originalStock = input.stock;
  return input;
}

async function listSellerProducts(req, res) {
  try {
    const products = await Product.find({
      seller: req.user._id,
      deleted: { $ne: true },
    }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, products });
  } catch (error) {
    console.error("listSellerProducts error:", error);
    return res.status(500).json({ success: false, message: "Failed to load your products." });
  }
}

async function createSellerProduct(req, res) {
  const validationError = validateProductBody(req.body, { creating: true });
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  try {
    const input = normalizeProductInput(req.body);
    if (input.retailPrice === undefined) {
      return res.status(400).json({ success: false, message: "retailPrice is required." });
    }
    const stock = input.stock ?? 0;
    const product = await Product.create({
      ...input,
      slug: await uniqueSlug(input.name),
      seller: req.user._id,
      stock,
      originalStock: stock,
      hidden: false,
      deleted: false,
      salesCount: 0,
      featuredOnLanding: false,
    });
    const io = req.app.get("io");
    if (io) io.emit("products_updated", { type: "seller_created", inserted: 1, updated: 0 });
    return res.status(201).json({ success: true, product });
  } catch (error) {
    console.error("createSellerProduct error:", error);
    return res.status(500).json({ success: false, message: "Failed to create product." });
  }
}

async function updateSellerProduct(req, res) {
  const validationError = validateProductBody(req.body);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  try {
    const existing = await Product.findOne({
      _id: req.params.id,
      seller: req.user._id,
      deleted: { $ne: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Product not found." });

    const updates = normalizeProductInput(req.body, existing);
    if (updates.name) updates.slug = await uniqueSlug(updates.name, existing._id);
    if (updates.stock !== undefined && updates.stock > 0) {
      updates.pendingDeleteAt = null;
      updates.hidden = false;
    }
    const product = await Product.findByIdAndUpdate(existing._id, updates, {
      new: true,
      runValidators: true,
    });
    const io = req.app.get("io");
    if (io) io.emit("products_updated", { type: "seller_updated", inserted: 0, updated: 1 });
    return res.json({ success: true, product });
  } catch (error) {
    console.error("updateSellerProduct error:", error);
    return res.status(500).json({ success: false, message: "Failed to update product." });
  }
}

async function deleteSellerProduct(req, res) {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller: req.user._id, deleted: { $ne: true } },
      { deleted: true, deletedAt: new Date(), hidden: true },
      { new: true },
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    const io = req.app.get("io");
    if (io) io.emit("product_deleted", { productId: product._id.toString() });
    return res.json({ success: true, message: "Product deleted." });
  } catch (error) {
    console.error("deleteSellerProduct error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete product." });
  }
}

async function getStorefront(req, res) {
  try {
    const seller = await User.findOne({
      role: "seller",
      storeSlug: req.params.slug.toLowerCase(),
    }).select("name storeName storeSlug");
    if (!seller) return res.status(404).json({ success: false, message: "Store not found." });
    const products = await Product.find({
      seller: seller._id,
      hidden: { $ne: true },
      deleted: { $ne: true },
    }).sort({ createdAt: -1 });
    return res.json({
      success: true,
      seller: {
        name: seller.name,
        storeName: seller.storeName || seller.name,
        storeSlug: seller.storeSlug,
      },
      products: products.map(publicProduct),
    });
  } catch (error) {
    console.error("getStorefront error:", error);
    return res.status(500).json({ success: false, message: "Failed to load store." });
  }
}

function productMatchesText(product, value) {
  const needle = String(value || "").trim().toLowerCase();
  if (!needle) return false;
  const name = String(product.name || "").trim().toLowerCase();
  const sku = String(product.sku || "").trim().toLowerCase();
  return (sku && (needle === sku || needle.includes(sku))) ||
    (name && (needle === name || needle.includes(name) || name.includes(needle)));
}

function textOrderItems(doc) {
  const count = Math.max(0, Number(doc.productCount) || 0);
  if (Array.isArray(doc.products) && doc.products.length) {
    return doc.products.map((item) => ({
      name: item?.name || "",
      sku: item?.sku || "",
      quantity: Number(item?.quantity ?? 1),
      price: Number(item?.price ?? 0),
    }));
  }
  return Array.from({ length: count }, (_, index) => {
    const i = index + 1;
    return {
      name: doc[`productName${i}`] || "",
      sku: doc[`productSku${i}`] || "",
      quantity: Number(doc[`qty${i}`] ?? 1),
      price: Number(doc[`productPrice${i}`] ?? 0),
    };
  });
}

function dateKey(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function daysSince(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function sellerAccountSnapshot(seller = {}) {
  const joinedDaysAgo = daysSince(seller.createdAt);
  const inactiveDays = daysSince(seller.lastActiveAt);
  return {
    id: String(seller._id || seller.id || ""),
    name: seller.name || "",
    email: seller.email || "",
    phone: seller.phone || "",
    storeName: seller.storeName || seller.name || "Seller store",
    storeSlug: seller.storeSlug || STORE_SLUG,
    role: seller.role || "seller",
    authProvider: seller.authProvider || "email",
    isVerified: seller.isVerified === true,
    orderConfirmationEmail: seller.orderConEmail || "",
    orderConfirmationEmailVerified: seller.orderConEmailVerified === true,
    shipmentEmailsCount: Array.isArray(seller.shipmentEmails) ? seller.shipmentEmails.length : 0,
    createdAt: seller.createdAt || null,
    lastActiveAt: seller.lastActiveAt || null,
    joinedDaysAgo,
    inactiveDays,
    accountStatus: inactiveDays === null || inactiveDays <= 30 ? "active" : inactiveDays <= 90 ? "dormant" : "inactive",
  };
}

async function buildSellerAnalytics(sellerId, sellerProfile = null) {
  const products = await Product.find({ seller: sellerId }).sort({ createdAt: -1 }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const productIds = products.map((product) => product._id);
  const emptyProductStats = () => ({ unitsSold: 0, revenue: 0, orders: 0, lastSoldAt: null });
  const productStats = new Map(products.map((product) => [String(product._id), emptyProductStats()]));
  const events = [];

  if (productIds.length) {
    const [orders, preOrders, mainOrders, historyOrders] = await Promise.all([
      Order.find({ "items.product": { $in: productIds } }).lean(),
      PreOrder.find({ "items.product": { $in: productIds } }).lean(),
      MainOrderCSVData.find({}).sort({ createdAt: -1 }).lean(),
      OrderHistory.find({}).sort({ exportedAt: -1 }).lean(),
    ]);

    const pendingOrderIds = new Set(preOrders.map((order) => String(order.order || "")));
    const archivedOrderIds = new Set(
      historyOrders.map((order) => String(order.sourceOrderID || order.orderID || "")),
    );

    const addEvent = ({ id, date, status, source, items, city = "", total = 0 }) => {
      const matchedItems = items
        .map((item) => {
          const productId = item.product?._id || item.product;
          const product = productMap.get(String(productId));
          return product ? { product, quantity: Number(item.quantity ?? 1), price: Number(item.price ?? product.retailPrice ?? 0) } : null;
        })
        .filter(Boolean);
      if (!matchedItems.length) return;

      const lineRevenue = matchedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const event = {
        id: String(id),
        date: date || new Date(),
        status: status || "pending",
        source,
        city: city || "—",
        units: matchedItems.reduce((sum, item) => sum + item.quantity, 0),
        revenue: lineRevenue || Number(total || 0),
        items: matchedItems,
      };
      events.push(event);
      matchedItems.forEach(({ product, quantity, price }) => {
        const stats = productStats.get(String(product._id));
        stats.unitsSold += quantity;
        stats.revenue += quantity * price;
        stats.orders += 1;
        if (!stats.lastSoldAt || new Date(event.date) > new Date(stats.lastSoldAt)) stats.lastSoldAt = event.date;
      });
    };

    orders.forEach((order) => {
      if (!pendingOrderIds.has(String(order._id))) {
        addEvent({
          id: order._id,
          date: order.createdAt,
          status: order.status,
          source: "checkout",
          items: order.items || [],
          total: order.totalAmount,
        });
      }
    });

    preOrders.forEach((order) => addEvent({
      id: order._id,
      date: order.createdAt,
      status: order.status || "pending",
      source: "pre_order",
      items: order.items || [],
      city: order.courierCity,
      total: order.totalAmount,
    }));

    const addTextOrder = (order, source, status) => {
      const items = textOrderItems(order);
      const matched = [];
      items.forEach((item) => {
        const product = products.find((candidate) =>
          productMatchesText(candidate, item.sku) || productMatchesText(candidate, item.name),
        );
        if (product) matched.push({ product: product._id, quantity: item.quantity, price: item.price });
      });
      addEvent({
        id: order._id || order.orderID,
        date: order.exportedAt || order.createdAt,
        status,
        source,
        items: matched,
        city: order.courierCity,
        total: order.sellPrice,
      });
    };

    mainOrders.forEach((order) => {
      const orderId = String(order.orderID || order._id || "");
      if (!archivedOrderIds.has(orderId)) addTextOrder(order, "main_order", order.exported ? "exported" : "confirmed");
    });
    historyOrders.forEach((order) => addTextOrder(order, "history", order.trackingStatus || "delivered"));
  }

  const uniqueEvents = [];
  const seenEventKeys = new Set();
  events.forEach((event) => {
    const key = `${event.source}:${event.id}`;
    if (!seenEventKeys.has(key)) {
      seenEventKeys.add(key);
      uniqueEvents.push(event);
    }
  });

  const now = Date.now();
  const last30 = uniqueEvents.filter((event) => now - new Date(event.date).getTime() <= 30 * 86_400_000);
  const seriesMap = new Map();
  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const date = new Date(now - daysAgo * 86_400_000);
    const key = dateKey(date);
    seriesMap.set(key, { date: key, revenue: 0, orders: 0, units: 0 });
  }
  last30.forEach((event) => {
    const key = dateKey(event.date);
    const point = seriesMap.get(key);
    if (point) {
      point.revenue += event.revenue;
      point.orders += 1;
      point.units += event.units;
    }
  });

  const statuses = new Map();
  uniqueEvents.forEach((event) => {
    const row = statuses.get(event.status) || { status: event.status, orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += event.revenue;
    statuses.set(event.status, row);
  });

  const productRows = products.map((product) => {
    const stats = productStats.get(String(product._id));
    return {
      id: String(product._id),
      name: product.name,
      sku: product.sku || "",
      category: product.category || "Uncategorized",
      price: Number(product.retailPrice || 0),
      stock: Number(product.stock || 0),
      salesCount: Number(product.salesCount || 0),
      hidden: product.hidden === true,
      deleted: product.deleted === true,
      unitsSold: stats.unitsSold,
      revenue: stats.revenue,
      orders: stats.orders,
      lastSoldAt: stats.lastSoldAt,
      imageUrl: product.imageUrl || "",
    };
  }).sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);

  const totalRevenue = productRows.reduce((sum, product) => sum + product.revenue, 0);
  const totalUnits = productRows.reduce((sum, product) => sum + product.unitsSold, 0);
  const pendingOrders = uniqueEvents.filter((event) => ["pending", "confirmed", "processing"].includes(event.status)).length;
  const deliveredOrders = uniqueEvents.filter((event) => event.status === "delivered").length;
  const cancelledOrders = uniqueEvents.filter((event) => event.status === "cancelled").length;
  const activeProductRows = productRows.filter((product) => !product.deleted && !product.hidden);
  const withImages = activeProductRows.filter((product) => product.imageUrl).length;
  const withDescriptions = activeProductRows.filter((product) => product.name && product.category && product.category !== "Uncategorized").length;
  const withSales = productRows.filter((product) => product.unitsSold > 0).length;
  const totalStockUnits = activeProductRows.reduce((sum, product) => sum + product.stock, 0);
  const averageProductPrice = activeProductRows.length
    ? activeProductRows.reduce((sum, product) => sum + product.price, 0) / activeProductRows.length
    : 0;
  const last7 = uniqueEvents.filter((event) => now - new Date(event.date).getTime() <= 7 * 86_400_000);
  const last90 = uniqueEvents.filter((event) => now - new Date(event.date).getTime() <= 90 * 86_400_000);
  const period = (eventsInPeriod) => ({
    revenue: eventsInPeriod.reduce((sum, event) => sum + event.revenue, 0),
    orders: eventsInPeriod.length,
    units: eventsInPeriod.reduce((sum, event) => sum + event.units, 0),
  });
  const categoryMap = new Map();
  productRows.forEach((product) => {
    const category = product.category || "Uncategorized";
    const row = categoryMap.get(category) || {
      category,
      products: 0,
      activeProducts: 0,
      stockUnits: 0,
      unitsSold: 0,
      orders: 0,
      revenue: 0,
      outOfStock: 0,
    };
    row.products += 1;
    if (!product.deleted && !product.hidden) row.activeProducts += 1;
    if (!product.deleted && !product.hidden) row.stockUnits += product.stock;
    row.unitsSold += product.unitsSold;
    row.orders += product.orders;
    row.revenue += product.revenue;
    if (!product.deleted && !product.hidden && product.stock <= 0) row.outOfStock += 1;
    categoryMap.set(category, row);
  });
  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
    .map((row) => ({
      ...row,
      averageOrderValue: row.orders ? row.revenue / row.orders : 0,
    }));
  const listingCompleteness = activeProductRows.length
    ? Math.round(((withImages + withDescriptions) / (activeProductRows.length * 2)) * 100)
    : 0;
  const deliveryRate = uniqueEvents.length ? (deliveredOrders / uniqueEvents.length) * 100 : 0;
  const cancellationRate = uniqueEvents.length ? (cancelledOrders / uniqueEvents.length) * 100 : 0;
  const stockRiskCount = productRows.filter((product) => !product.deleted && product.stock <= 5).length;
  const accountHealthScore = Math.max(0, Math.min(100, Math.round(
    (activeProductRows.length ? 25 : 0) +
    Math.min(25, listingCompleteness * 0.25) +
    (totalRevenue > 0 ? 20 : 0) +
    (uniqueEvents.length && cancellationRate < 10 ? 15 : uniqueEvents.length ? 7 : 0) +
    (stockRiskCount === 0 ? 15 : stockRiskCount <= 2 ? 8 : 2),
  )));
  const healthSignals = [];
  if (!activeProductRows.length) healthSignals.push({ tone: "critical", title: "No live listings", detail: "Publish at least one active product to make this store discoverable." });
  if (listingCompleteness < 75 && activeProductRows.length) healthSignals.push({ tone: "warning", title: "Catalog content needs attention", detail: `${activeProductRows.length - withImages} live listing${activeProductRows.length - withImages === 1 ? "" : "s"} have no image or ${activeProductRows.length - withDescriptions} need category cleanup.` });
  if (stockRiskCount > 0) healthSignals.push({ tone: "warning", title: "Inventory risk", detail: `${stockRiskCount} live listing${stockRiskCount === 1 ? " is" : "s are"} at or below five units.` });
  if (cancellationRate >= 10) healthSignals.push({ tone: "critical", title: "Cancellation rate is elevated", detail: `${cancellationRate.toFixed(1)}% of attributed orders are cancelled.` });
  if (uniqueEvents.length && deliveryRate >= 80) healthSignals.push({ tone: "positive", title: "Reliable fulfillment", detail: `${deliveryRate.toFixed(1)}% of attributed orders are delivered.` });
  if (!healthSignals.length) healthSignals.push({ tone: "positive", title: "Account is in good standing", detail: "No immediate catalog, inventory, or fulfillment risks detected." });

  return {
    generatedAt: Date.now(),
    account: sellerAccountSnapshot(sellerProfile || {}),
    health: {
      score: accountHealthScore,
      label: accountHealthScore >= 80 ? "Strong" : accountHealthScore >= 55 ? "Watch" : "Needs attention",
      signals: healthSignals,
    },
    kpi: {
      productsTotal: productRows.length,
      activeProducts: productRows.filter((product) => !product.deleted && !product.hidden).length,
      lowStockProducts: productRows.filter((product) => !product.deleted && product.stock > 0 && product.stock <= 5).length,
      outOfStockProducts: productRows.filter((product) => !product.deleted && product.stock <= 0).length,
      inventoryValue: productRows.reduce((sum, product) => sum + product.stock * product.price, 0),
      totalUnitsSold: totalUnits,
      totalRevenue,
      totalOrders: uniqueEvents.length,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      averageOrderValue: uniqueEvents.length ? totalRevenue / uniqueEvents.length : 0,
      revenue30d: last30.reduce((sum, event) => sum + event.revenue, 0),
      orders30d: last30.length,
    },
    periods: {
      last7: period(last7),
      last30: period(last30),
      last90: period(last90),
      allTime: period(uniqueEvents),
    },
    catalog: {
      activeProducts: activeProductRows.length,
      hiddenProducts: productRows.filter((product) => product.hidden && !product.deleted).length,
      deletedProducts: productRows.filter((product) => product.deleted).length,
      withImages,
      withDescriptions,
      withSales,
      totalStockUnits,
      averageProductPrice,
      listingCompleteness,
      categories,
    },
    fulfillment: {
      deliveryRate,
      cancellationRate,
      pendingRate: uniqueEvents.length ? (pendingOrders / uniqueEvents.length) * 100 : 0,
      deliveredRevenue: uniqueEvents.filter((event) => event.status === "delivered").reduce((sum, event) => sum + event.revenue, 0),
      cancelledRevenue: uniqueEvents.filter((event) => event.status === "cancelled").reduce((sum, event) => sum + event.revenue, 0),
    },
    series: Array.from(seriesMap.values()),
    statuses: Array.from(statuses.values()).sort((a, b) => b.orders - a.orders),
    products: productRows,
    recentOrders: uniqueEvents
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map((event) => ({
        id: event.id,
        date: event.date,
        status: event.status,
        source: event.source,
        city: event.city,
        units: event.units,
        revenue: event.revenue,
      })),
  };
}

async function getSellerAnalytics(req, res) {
  try {
    const analytics = await buildSellerAnalytics(req.user._id, req.user);
    return res.json({
      success: true,
      seller: sellerAccountSnapshot(req.user),
      analytics,
    });
  } catch (error) {
    console.error("getSellerAnalytics error:", error);
    return res.status(500).json({ success: false, message: "Failed to load seller analytics." });
  }
}

async function getSellerMonitoring(req, res) {
  try {
    const sellers = await User.find({ role: "seller" })
      .select("name email phone storeName storeSlug role authProvider isVerified orderConEmail orderConEmailVerified shipmentEmails createdAt lastActiveAt")
      .sort({ createdAt: -1 })
      .lean();
    const rows = await Promise.all(sellers.map(async (seller) => ({
      seller: sellerAccountSnapshot(seller),
      analytics: await buildSellerAnalytics(seller._id, seller),
    })));
    return res.json({ success: true, sellers: rows, generatedAt: Date.now() });
  } catch (error) {
    console.error("getSellerMonitoring error:", error);
    return res.status(500).json({ success: false, message: "Failed to load seller monitoring." });
  }
}

module.exports = {
  listSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  getStorefront,
  getSellerAnalytics,
  getSellerMonitoring,
  STORE_SLUG,
};