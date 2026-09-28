const { Readable } = require("stream");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const Groq = require("groq-sdk");
const Product = require("../models/Product");
const User = require("../models/User");
const Settings = require("../models/Settings");
const Report = require("../models/Report");
const Category = require("../models/Category");
const OutOfStockDeletedProduct = require("../models/OutOfStockDeletedProduct");
const PreOrder = require("../models/PreOrder");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const OrderHistory = require("../models/OrderHistory");
const DynamicData = require("../models/DynamicData");
const TrendingSearch = require("../models/TrendingSearch");
const { scheduleDeletion, cancelDeletion } = require("../utils/outOfStockManager");
const { resetReminderState } = require("../utils/activeUserMonitor");
const { optimizeProductCopy } = require("../utils/groqProductOptimizer");
const groqKeyPool = require("../utils/groqKeyPool");
const {
  loadPricingRules,
  priceProductFromRules,
  clearPricingRulesCache,
} = require("../utils/pricing");
const { generateKeywords } = require("../utils/seoKeywords");

// ── Keyword map: slug → name fragments to match against product names ─────────
// Used by the category filter in getProducts. Kept in sync with utils/categorize.js.
const { CATEGORIES, categorizeProduct } = require("../utils/categorize");
const CATEGORY_KEYWORDS = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, [...(c.strong || []), ...(c.weak || [])]])
);

// ── Public catalogue list cache ─────────────────────────────────────────────
// Product list responses are cached in-memory for a short TTL. Products change
// rarely and the cache is cleared on every mutation, so repeat visitors never
// pay the cost of scanning the catalogue.
const LIST_CACHE_TTL = 30_000;
const MAX_LIST_CACHE_ENTRIES = 500;
const listCache = new Map(); // key -> { at, payload }
function getCachedList(key) {
  const entry = listCache.get(key);
  if (entry && Date.now() - entry.at < LIST_CACHE_TTL) return entry.payload;
  if (entry) listCache.delete(key);
  return null;
}
function setCachedList(key, payload) {
  if (listCache.size >= MAX_LIST_CACHE_ENTRIES) {
    const oldest = listCache.keys().next().value;
    if (oldest !== undefined) listCache.delete(oldest);
  }
  listCache.set(key, { at: Date.now(), payload });
}
function invalidateProductListCache() {
  listCache.clear();
}
function listCacheControl(res) {
  return res.set("Cache-Control", "public, max-age=30, s-maxage=60");
}

// ── Lean projection for catalogue lists ──────────────────────────────────────
// Only fields needed to render product cards / catalogue rows. Excludes heavy
// blobs (rawData, gallery, variations, wholesalePrice, uploadBatch) so list
// queries avoid dragging the full document across the wire.
const LIST_PROJECTION = {
  _id: 1,
  name: 1,
  slug: 1,
  retailPrice: 1,
  price: 1,
  imageUrl: 1,
  stock: 1,
  inStock: 1,
  category: 1,
  createdAt: 1,
  salesCount: 1,
  sku: 1,
  weight: 1,
  videoUrl: 1,
  productId: 1,
  updatedAt: 1,
  featuredOnLanding: 1,
  featuredOrder: 1,
};

// ── Shared availability: HHC variations are the source of truth when present ──
function productAvailability(product) {
  const variations = Array.isArray(product?.variations) ? product.variations : [];
  const stockVal = Number(product?.stock ?? 0);
  if (variations.length > 0) {
    const available = variations.reduce(
      (sum, v) => sum + (Number(v?.quantity) > 0 ? Number(v.quantity) : 0),
      0
    );
    return { inStock: available > 0, available };
  }
  return { inStock: stockVal > 0, available: stockVal };
}

// A variation is only usable when it carries a price and a quantity. When
// these are missing the page cannot show a sell price/stock for it, so the
// DynamicData collection (matched by productId) is used to fill the blanks.
function isVariationPriceable(v) {
  return (
    !!v &&
    ((v?.price !== undefined && v?.price !== null && !Number.isNaN(Number(v.price)) && Number(v.price) > 0) ||
      (v?.salePrice !== undefined && v?.salePrice !== null && !Number.isNaN(Number(v.salePrice)) && Number(v.salePrice) > 0))
  );
}
function isVariationStockable(v) {
  return !!v && v?.quantity !== undefined && v?.quantity !== null && !Number.isNaN(Number(v.quantity));
}

// ── Strip exact stock + wholesale pricing from customer-facing responses ─────
function toCustomerProduct(product) {
  if (!product) return product;
  const obj = product.toObject ? product.toObject() : { ...product };
  obj.inStock = productAvailability(obj).inStock;
  delete obj.stock;
  delete obj.newProduct;
  delete obj.rawData;
  delete obj.hidden;
  delete obj.seller;
  delete obj.wholesalePrice;
  if (Array.isArray(obj.variations)) {
    obj.variations = obj.variations.map((v) => {
      const clone = v && typeof v === "object" ? { ...v } : v;
      if (clone && typeof clone === "object") delete clone.wholesalePrice;
      return clone;
    });
  }
  return obj;
}

// ── Normalizers ───────────────────────────────────────────────────────────────
const norm = (s) => (s || "").toLowerCase().replace(/[\s\-_()/?]+/g, "");

const slugify = (name) => {
  if (!name) return "";
  // Step 1: standard slug (strip non-ASCII, collapse whitespace/hyphens)
  let slug = name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200);
  if (slug) return slug;
  // Step 2: fallback — keep any surviving word chars after stripping
  slug = name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\W+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200);
  if (slug) return slug;
  // Step 3: last resort — guaranteed-unique timestamp slug
  return `product-${Date.now().toString(36)}`;
};

// ── Unique slug generator — appends -2, -3, … on collision ──────────────────
const uniqueSlug = async (base, excludeId) => {
  let slug = base || `product-${Date.now().toString(36)}`;
  for (let suffix = 2; suffix <= 1000; suffix++) {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await Product.findOne(q).lean();
    if (!exists) break;
    slug = `${base}-${suffix}`;
  }
  return slug;
};

const decodeEntities = (str) => {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
};

const takeFirst = (val) => {
  if (!val) return "";
  return val.split(",")[0].trim();
};

const pick = (row, ...variants) => {
  const r = {};
  Object.keys(row).forEach((k) => {
    r[norm(k)] = (row[k] || "").trim();
  });
  for (const v of variants) {
    const val = r[norm(v)];
    if (val !== undefined && val !== "") return val;
  }
  return "";
};

const parseNum = (str) => {
  const n = parseFloat((str || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

const parseIntSafe = (str) => {
  const n = parseInt((str || "").replace(/[^0-9]/g, ""), 10);
  return isNaN(n) || n < 0 ? 0 : n;
};

// ── CSV parsing ───────────────────────────────────────────────────────────────
const parseCSVBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer.toString("utf8"))
      .pipe(csv({ skipEmptyLines: true }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

const mapRow = (row, batch) => {
  // Skip variation rows (child products that inherit from parent)
  const type = pick(row, "Type", "product_type", "type");
  if (type && type.toLowerCase() === "variation") return null;

  const name = pick(
    row,
    "Product Title",
    "title",
    "name",
    "product_name",
    "product title",
    "item_name",
    "product",
    "item",
  );
  if (!name) return null;

  const rawPrice = pick(
    row,
    "Regular price",
    "regular price",
    "Suggested Retail Price (PKR)",
    "suggested retail price",
    "retail price",
    "selling price",
    "price",
    "mrp",
    "sale price",
  );

  // Separate boolean "In stock?" from actual stock quantity columns
  const inStockFlag = pick(row, "In stock?", "in stock");
  const stockQty = pick(
    row,
    "Stock Quantity",
    "stock",
    "quantity",
    "qty",
    "inventory",
    "available",
    "units",
  );
  // If a quantity column exists with a numeric value, use it.
  // Otherwise, use "In stock?" as a boolean: 1 = 1 unit available, 0 = out of stock.
  const parsedQty = parseIntSafe(stockQty);
  const stockValue =
    stockQty !== ""
      ? parsedQty
      : inStockFlag === "1" || inStockFlag === "yes"
        ? 1
        : 0;

  const rawCategory = pick(
    row,
    "Categories",
    "categories",
    "Category",
    "type",
    "department",
    "section",
    "cat",
    "group",
  );

  const rawImages = pick(
    row,
    "Images",
    "images",
    "Image URL",
    "image url",
    "image",
    "img",
    "img_url",
    "photo",
    "picture",
    "thumbnail",
    "image_link",
    "Product Image",
    "product image",
    "product_image",
    "Main Image",
    "main image",
    "main_image",
    "Featured Image",
    "featured image",
    "featured_image",
    "product_thumbnail",
    "Product Thumbnail",
  );

  const rawVideos = pick(
    row,
    "Video",
    "video",
    "Video URL",
    "video url",
    "video_url",
    "VideoUrl",
    "video_link",
    "videos",
    "Videos",
  );

  const rawDesc = pick(
    row,
    "Description",
    "desc",
    "details",
    "about",
    "info",
    "summary",
    "Short description",
    "short description",
  );

  return {
    productId: pick(row, "ID", "Product ID", "product id", "id", "product_id", "pid"),
    sku: pick(
      row,
      "SKU",
      "sku code",
      "sku_code",
      "article_no",
      "code",
      "barcode",
    ),
    name,
    description: decodeEntities(rawDesc),
    wholesalePrice: parseNum(rawPrice),
    retailPrice: 0,
    stock: stockValue,
    originalStock: stockValue,
    category: categorizeProduct(name, decodeEntities(rawDesc)),
    imageUrl: takeFirst(rawImages),
    videoUrl: takeFirst(rawVideos),
    weight: parseNum(
      pick(row, "Weight (kg)", "weight", "weight kg", "wt", "wt_kg"),
    ),
    salesCount: 0,
    uploadBatch: batch,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/upload-csv  (admin only)
// Merges CSV products — does NOT delete existing products.
// Updates existing (by name), inserts new, and applies saved category pricing.
// ─────────────────────────────────────────────────────────────────────────────
const uploadCSV = async (req, res) => {
  invalidateProductListCache();
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No CSV file attached." });
    }

    let rows;
    try {
      rows = await parseCSVBuffer(req.file.buffer);
    } catch {
      return res
        .status(400)
        .json({
          success: false,
          message: "Could not parse CSV. Make sure the file is valid.",
        });
    }

    if (!rows.length) {
      return res
        .status(400)
        .json({ success: false, message: "The CSV file is empty." });
    }

    const batch = new Date().toISOString();
    let parsed = rows.map((r) => mapRow(r, batch)).filter(Boolean);

    parsed = await optimizeProductCopy(parsed, (progress) => {
      if (progress.optimized && (progress.optimized % 10 === 0 || progress.optimized === progress.total)) {
        console.log(`Groq product copy optimization: ${progress.optimized}/${progress.total}`);
      }
    });

    if (parsed.length > 0) {
      console.log("First 3 imported products (stock check):");
      parsed.slice(0, 3).forEach((p, i) =>
        console.log(`  ${i + 1}. "${p.name}" → stock: ${p.stock}, price: ${p.retailPrice}, cat: "${p.category}"`),
      );
    }

    if (!parsed.length) {
      return res.status(400).json({
        success: false,
        message:
          'No valid rows found. Ensure CSV has a "Product Title" or "name" column.',
      });
    }

    // ── Auto-generate deterministic SEO keywords for every imported row ──────
    for (const p of parsed) {
      p.keywords = generateKeywords(p.name, p.category);
    }

    // ── Load pricing settings + rules (price range → category → global) ────
    const existingSettings = await Settings.findOne({});
    const rules = await loadPricingRules();

    // ── Auto-create any categories from CSV that don't exist yet ────────────
    // Each category is created independently so a slug collision (e.g.
    // "Men's Shoes" vs "Mens Shoes") can't abort the whole import.
    const uniqueCategories = [...new Set(parsed.map((p) => p.category).filter(Boolean))];
    let categoryErrors = 0;
    for (const catName of uniqueCategories) {
      try {
        await Category.findOrCreateCategory(catName);
      } catch (err) {
        categoryErrors++;
        console.error(`Failed to create category "${catName}":`, err.message);
      }
    }

    // ── Merge: update existing by SKU/productId, insert new ────────────────────
    let inserted = 0;
    let updated = 0;
    for (const p of parsed) {
      // Try to match by SKU first, then productId
      const existing = p.sku
        ? await Product.findOne({ sku: p.sku })
        : p.productId
          ? await Product.findOne({ productId: p.productId })
          : null;

      // Apply pricing: price range overrides everything, then category %,
 // then global %, else keep imported price (runs for both new & existing)
 const priced = priceProductFromRules(p.wholesalePrice, p.category, false, rules);
 if (priced) {
   p.retailPrice = priced.retail;
   p.lowPrice = priced.lowPrice;
 }

 if (existing) {
   // Preserve salesCount and clear stockOutAt if restocked
   p.salesCount = existing.salesCount;
   if (p.stock > 0) p.stockOutAt = null;
   p.slug = await uniqueSlug(slugify(p.name) || existing.slug, existing._id);
   // Preserve admin/booster keywords if already set — don't overwrite
   // with freshly generated ones on a re-import.
   if (Array.isArray(existing.keywords) && existing.keywords.length > 0) {
     delete p.keywords;
   }
   await Product.updateOne({ _id: existing._id }, { $set: p });
   updated++;
 } else {
   if (p.stock > 0) p.stockOutAt = null;
   p.slug = await uniqueSlug(slugify(p.name) || slugify(p.sku));
   await Product.create(p);
   inserted++;
 }
    }

    // ── Handle report period ──────────────────────────────────────────────────
    const now = new Date();

    if (!existingSettings || !existingSettings.periodStart) {
      // First upload — start fresh 30-day period
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const allProducts = await Product.find({});
      const snapshot = {};
      allProducts.forEach((p) => {
        snapshot[p._id.toString()] = p.salesCount;
      });
      await Settings.findOneAndUpdate(
        {},
        {
          periodNumber: 1,
          periodStart: now,
          periodEnd,
          salesSnapshot: snapshot,
        },
        { upsert: true, new: true },
      );
    } else {
      // Subsequent upload — only add new products to snapshot
      const snapshot = existingSettings.salesSnapshot || {};
      const allProducts = await Product.find({});
      let newCount = 0;
      allProducts.forEach((p) => {
        if (snapshot[p._id.toString()] === undefined) {
          snapshot[p._id.toString()] = p.salesCount;
          newCount++;
        }
      });
      if (newCount > 0) {
        await Settings.findOneAndUpdate({}, { salesSnapshot: snapshot });
      }
    }

    // ── Emit real-time event ──────────────────────────────────────────────────
    const io = req.app.get("io");
    if (io) {
      io.emit("products_updated", {
        type: "csv_uploaded",
        inserted,
        updated,
        message: `${inserted} new, ${updated} updated`,
      });
    }

    // Reset active user monitor reminders so the 2-minute cycle restarts
    resetReminderState();

    const totalProducts = await Product.countDocuments({});
    return res.status(200).json({
      success: true,
      message: `${inserted} new products added, ${updated} existing updated. Total: ${totalProducts} products.`,
      count: totalProducts,
      inserted,
      updated,
      batch,
    });
  } catch (err) {
    console.error("uploadCSV error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error while processing CSV." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/manual  (admin only)
// Manually creates a single product (Product Hunting workflow).
// Mirrors the uploadCSV pricing/creation logic for one product.
// ─────────────────────────────────────────────────────────────────────────────
const createManualProduct = async (req, res) => {
  invalidateProductListCache();
  try {
    const {
      name,
      wholesalePrice,
      category,
      stock,
      weight,
      imageUrl,
      videoUrl,
      description,
      featuredOnLanding,
    } = req.body || {};

    // ── Validate input ──────────────────────────────────────────────────────
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Product name is required." });
    }

    const wholesale = Number(wholesalePrice);
    if (
      wholesalePrice === undefined ||
      wholesalePrice === null ||
      wholesalePrice === "" ||
      !Number.isFinite(wholesale) ||
      wholesale < 0
    ) {
      return res.status(400).json({ success: false, message: "wholesalePrice must be a finite number >= 0." });
    }

    const cat =
      typeof category === "string" && category.trim() ? category.trim() : "Uncategorized";

    const stockNum = stock === undefined || stock === null ? 0 : Number(stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      return res.status(400).json({ success: false, message: "stock must be a number >= 0." });
    }

    const weightNum = weight === undefined || weight === null ? 0 : Number(weight);
    if (!Number.isFinite(weightNum) || weightNum < 0) {
      return res.status(400).json({ success: false, message: "weight must be a number >= 0." });
    }

    if (imageUrl !== undefined && typeof imageUrl !== "string") {
      return res.status(400).json({ success: false, message: "imageUrl must be a string." });
    }
    if (videoUrl !== undefined && typeof videoUrl !== "string") {
      return res.status(400).json({ success: false, message: "videoUrl must be a string." });
    }
    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({ success: false, message: "description must be a string." });
    }
    if (featuredOnLanding !== undefined && typeof featuredOnLanding !== "boolean") {
      return res.status(400).json({ success: false, message: "featuredOnLanding must be a boolean." });
    }

    // ── Load pricing rules (mirrors uploadCSV merge block) ─────────────────
    const rules = await loadPricingRules();

    // Price range overrides everything; category % then global % are fallbacks
    let retailPrice = 0;
    let lowPrice = false;
    const priced = priceProductFromRules(wholesale, cat, false, rules);
    if (priced) {
      retailPrice = priced.retail;
      lowPrice = priced.lowPrice;
    }

    // ── Auto-create the category if it doesn't exist (mirrors uploadCSV) ────
    await Category.findOrCreateCategory(cat);

    // ── Unique slug: base slug, append numeric suffix on collision ──────────
    const slug = await uniqueSlug(slugify(name.trim()));

    // ── Create the product ──────────────────────────────────────────────────
    const doc = await Product.create({
      name: name.trim(),
      slug,
      description: typeof description === "string" ? description : "",
      wholesalePrice: wholesale,
      retailPrice,
      lowPrice,
      stock: stockNum,
      originalStock: stockNum,
      weight: weightNum,
      imageUrl: typeof imageUrl === "string" ? imageUrl : "",
      videoUrl: typeof videoUrl === "string" ? videoUrl : "",
      category: cat,
      featuredOnLanding: featuredOnLanding === undefined ? true : featuredOnLanding,
      hidden: false,
      salesCount: 0,
      stockOutAt: null,
      sku: "",
      keywords: generateKeywords(name.trim(), cat),
    });

    // ── Emit real-time event (same io/emit wiring as uploadCSV) ─────────────
    const io = req.app.get("io");
    if (io) {
      io.emit("products_updated", {
        type: "manual_created",
        inserted: 1,
        updated: 0,
        message: "1 new",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Product created and added to the main page.",
      product: doc.toPublicObject(),
    });
  } catch (err) {
    console.error("createManualProduct error:", err);
    return res.status(500).json({ success: false, message: "Server error while creating product." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products  (all authenticated users)
// ─────────────────────────────────────────────────────────────────────────────
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Applies brand + price filters to a MongoDB query object. Shared by BOTH the
// $text search path and the $regex fallback path so `total`/`pages` always
// reflect the same filtered set. Extra $and clauses combine cleanly with
// top-level $text, $or and the nested category $and used above.
const applySearchFilters = (targetQuery, { brand, minPrice, maxPrice }) => {
  const conditions = [];

  if (brand) {
    // Product has no brand field; replicate the removed frontend hack
    // (name.toLowerCase().includes(brand)) as a case-insensitive substring regex.
    conditions.push({ name: { $regex: escapeRegex(brand), $options: "i" } });
  }

  const price = {};
  if (minPrice != null) price.$gte = minPrice;
  if (maxPrice != null) price.$lte = maxPrice;
  if (Object.keys(price).length > 0) {
    conditions.push({ retailPrice: price });
  }

  if (conditions.length === 0) return;
  if (Array.isArray(targetQuery.$and)) {
    targetQuery.$and.push(...conditions);
  } else {
    targetQuery.$and = conditions;
  }
};

const getProducts = async (req, res) => {
  try {
    const {
      search = "",
      sort = "",
      page = 1,
      limit = 60,
      category = "",
      brand = "",
      min_price,
      max_price,
    } = req.query;
    const query = { hidden: { $ne: true }, deleted: { $ne: true } };
    let textScoreSort = false;

    // Serve repeat requests from the short-lived list cache.
    const listKey = req.originalUrl;
    const cached = getCachedList(listKey);
    if (cached) {
      return listCacheControl(res).status(200).json(cached);
    }

    // Parse price bounds: ignore NaN/negative; 0 or absent means "no bound".
    const rawMinPrice = parseFloat(min_price);
    const rawMaxPrice = parseFloat(max_price);
    const minPrice = Number.isFinite(rawMinPrice) && rawMinPrice > 0 ? rawMinPrice : null;
    const maxPrice = Number.isFinite(rawMaxPrice) && rawMaxPrice > 0 ? rawMaxPrice : null;

    if (search) {
      const sanitized = search.trim();
      // Try $text search first (relevance-ranked, handles stemming & partial words)
      query.$text = { $search: sanitized };
      textScoreSort = true;
    }

    // Record the search term for trending suggestions — fire-and-forget, never
    // awaited so a Mongo hiccup can't slow or fail the product response.
    const recordedTerm = (search || "").trim();
    if (recordedTerm) {
      TrendingSearch.findOneAndUpdate(
        { term: recordedTerm.toLowerCase() },
        { $inc: { count: 1 }, $set: { lastSearchedAt: new Date() } },
        { upsert: true },
      )
        .exec()
        .catch((err) =>
          console.error("Failed to record trending search:", err?.message || err),
        );
    }

    if (category) {
      const cat = await Category.findOne({ slug: category }).lean();
      const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] || [];

      const orConditions = [];

      if (cat) {
        orConditions.push({ category: cat.name });
      }
      const slugPattern = escapeRegex(category).replace(/-/g, "[\\s\\-&]+");
      orConditions.push({ category: { $regex: slugPattern, $options: "i" } });

      if (keywords.length > 0) {
        orConditions.push({
          name: { $regex: keywords.join("|"), $options: "i" },
        });
      }

      if (query.$text) {
        const textClause = { $text: query.$text };
        delete query.$text;
        query.$and = [{ $or: [textClause] }, { $or: orConditions }];
        textScoreSort = true;
      } else {
        query.$or = orConditions;
      }
    }

    // Apply brand/price filters to the primary ($text) query BEFORE counting so
    // total/pages reflect the filtered result set.
    applySearchFilters(query, { brand, minPrice, maxPrice });

    const sortMap = {
      price_asc: { retailPrice: 1 },
      price_desc: { retailPrice: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      trending: { salesCount: -1 },
      oldest: { createdAt: 1 },
    };
    let sortObj = sortMap[sort] || { page: 1, createdAt: -1 };
    if (textScoreSort && !sort) {
      sortObj = { score: { $meta: "textScore" } };
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let projection = { ...LIST_PROJECTION };
    if (textScoreSort) {
      projection = { ...LIST_PROJECTION, score: { $meta: "textScore" } };
    }

    const [products, total] = await Promise.all([
      Product.find(query, projection)
        .skip(skip)
        .limit(limitNum)
        .sort(sortObj)
        .lean(),
      Product.countDocuments(query),
    ]);

    // If $text returned no results, fall back to $regex (substring/partial matching)
    if (search && products.length === 0) {
      const regexQuery = { hidden: { $ne: true }, deleted: { $ne: true } };
      const escaped = escapeRegex(search.trim());
      regexQuery.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { sku: { $regex: escaped, $options: "i" } },
        { productId: { $regex: escaped, $options: "i" } },
        // Per-product SEO keywords (e.g. "best hand gripper") — substring match
        { keywords: { $regex: escaped, $options: "i" } },
      ];

      if (category) {
        const cat = await Category.findOne({ slug: category }).lean();
        const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] || [];
        const orConditions = [];
        if (cat) orConditions.push({ category: cat.name });
        const slugPattern = category.replace(/-/g, "[\\s\\-&]+");
        orConditions.push({ category: { $regex: slugPattern, $options: "i" } });
        if (keywords.length > 0) {
          orConditions.push({ name: { $regex: keywords.join("|"), $options: "i" } });
        }
        if (regexQuery.$or) {
          regexQuery.$and = [{ $or: regexQuery.$or }, { $or: orConditions }];
          delete regexQuery.$or;
        } else {
          regexQuery.$or = orConditions;
        }
      }

      // Apply brand/price filters to the $regex fallback path too, so fallback
      // total/pages match the same filtered result set as the $text path.
      applySearchFilters(regexQuery, { brand, minPrice, maxPrice });

      const fallbackSortObj = sortMap[sort] || { page: 1, createdAt: -1 };
      const [fallbackProducts, fallbackTotal] = await Promise.all([
        Product.find(regexQuery, LIST_PROJECTION)
          .skip(skip)
          .limit(limitNum)
          .sort(fallbackSortObj)
          .lean(),
        Product.countDocuments(regexQuery),
      ]);

      const safeFallback = fallbackProducts.map(toCustomerProduct);
      const payload = {
        success: true,
        products: safeFallback,
        total: fallbackTotal,
        page: pageNum,
        pages: Math.ceil(fallbackTotal / limitNum),
      };
      setCachedList(listKey, payload);
      return listCacheControl(res).status(200).json(payload);
    }

    const safeProducts = products.map(toCustomerProduct);

    const payload = {
      success: true,
      products: safeProducts,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
    setCachedList(listKey, payload);
    return listCacheControl(res).status(200).json(payload);
  } catch (err) {
    console.error("getProducts error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch products." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/suggest?q=&limit=  (public)
// Returns { queries, products }: query suggestions derived from product-name
// prefix matches (ordered by salesCount, deduped, capped at limit) plus a lean
// set of matching products using the same $text search as getProducts.
// ─────────────────────────────────────────────────────────────────────────────
const getSuggestions = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const rawLimit = parseInt(req.query.limit, 10);
    const limitVal = Math.min(20, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 5));

    if (!q) {
      return res.status(200).json({ success: true, queries: [], products: [] });
    }

    // Products — same $text search as getProducts, with the same $regex
    // fallback when $text finds nothing (prefix/partial name matching).
    const searchQuery = { hidden: { $ne: true } };
    let products = [];
    if (q) {
      searchQuery.$text = { $search: q };
      products = await Product.find(searchQuery, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .limit(limitVal)
        .lean();
      if (products.length === 0) {
        const qEscaped = escapeRegex(q);
        products = await Product.find({
          hidden: { $ne: true },
          $or: [
            { name: { $regex: qEscaped, $options: "i" } },
            // Per-product SEO keywords (e.g. "best hand gripper") — substring match
            { keywords: { $regex: qEscaped, $options: "i" } },
          ],
        })
          .sort({ salesCount: -1 })
          .limit(limitVal)
          .lean();
      }
    }

    // Queries — product names that START with the typed prefix, best-selling
    // first; dedupe and cap at the same limit.
    const qEscaped = escapeRegex(q);
    const nameMatches = await Product.find({
      hidden: { $ne: true },
      name: { $regex: `^${qEscaped}`, $options: "i" },
    })
      .sort({ salesCount: -1, name: 1 })
      .limit(100)
      .lean();

    const queries = [];
    const seen = new Set();
    for (const p of nameMatches) {
      const name = (p.name || "").trim();
      if (!name) continue;
      // Suggest the full product name, truncated only for very long titles.
      const suggestion = name.length > 60 ? name.slice(0, 60).trim() : name;
      const key = suggestion.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push(suggestion);
      if (queries.length >= limitVal) break;
    }

    const safeProducts = products.map(toCustomerProduct);
    return res.status(200).json({ success: true, queries, products: safeProducts });
  } catch (err) {
    console.error("getSuggestions error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch suggestions." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/trending-searches?limit=  (public)
// Returns the most-searched terms [{ term, count }] from TrendsSearch,
// ordered by count DESC.
// ─────────────────────────────────────────────────────────────────────────────
const getTrendingSearches = async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limitVal = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));
    const trending = await TrendingSearch.find({})
      .sort({ count: -1 })
      .limit(limitVal)
      .lean();
    const rows = trending.map((t) => ({ term: t.term, count: t.count }));
    return res.status(200).json({ success: true, trending: rows });
  } catch (err) {
    console.error("getTrendingSearches error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch trending searches." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/leaderboard  (admin only)
// Returns products sorted by salesCount DESC.
// ─────────────────────────────────────────────────────────────────────────────
const getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 0;
    let q = Product.find({})
      .sort({ salesCount: -1, name: 1 })
      .select(
        "name category retailPrice stock originalStock salesCount imageUrl sku productId createdAt",
      );
    if (limit > 0) q = q.limit(Math.min(limit, 5000));
    const products = await q;

    return res.status(200).json({ success: true, products });
  } catch (err) {
    console.error("getLeaderboard error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch leaderboard." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/report  (admin only)
//
// Returns current period status OR the completed monthly report.
// If 30 days have elapsed and no report exists yet, auto-generates it
// and starts a fresh 30-day period automatically.
// ─────────────────────────────────────────────────────────────────────────────
const getReport = async (req, res) => {
  try {
    const settings = await Settings.findOne({});

    if (!settings || !settings.periodStart) {
      return res.status(200).json({
        success: true,
        status: "no_period",
        message:
          "No report period started yet. Upload a CSV file to begin the 30-day tracking period.",
      });
    }

    const now = new Date();
    const periodEnd = new Date(settings.periodEnd);
    const isComplete = now >= periodEnd;
    const msRemaining = Math.max(0, periodEnd - now);
    const daysLeft = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const daysElapsed = 30 - daysLeft;

    // ── Period still running ──────────────────────────────────────────────────
    if (!isComplete) {
      const products = await Product.find({})
        .sort({ salesCount: -1, name: 1 })
        .select("name sku category retailPrice salesCount productId");

      const snapshot = settings.salesSnapshot || {};

      // Calculate sales IN this period for each product
      const standings = products
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          category: p.category,
          retailPrice: p.retailPrice,
          periodSales: p.salesCount - (snapshot[p._id.toString()] || 0),
          totalSales: p.salesCount,
        }))
        .sort((a, b) => b.periodSales - a.periodSales)
        .map((p, i) => ({ rank: i + 1, ...p }));

      return res.status(200).json({
        success: true,
        status: "ongoing",
        periodNumber: settings.periodNumber,
        periodStart: settings.periodStart,
        periodEnd: settings.periodEnd,
        daysElapsed,
        daysLeft,
        standings,
      });
    }

    // ── Period complete — get or generate report ───────────────────────────────
    let report = await Report.findOne({ periodNumber: settings.periodNumber });

    if (!report) {
      // Auto-generate the report
      const products = await Product.find({})
        .sort({ salesCount: -1, name: 1 })
        .select("name sku category retailPrice salesCount productId");

      const snapshot = settings.salesSnapshot || {};

      const ranked = products
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          category: p.category,
          retailPrice: p.retailPrice,
          periodSales: p.salesCount - (snapshot[p._id.toString()] || 0),
          totalSales: p.salesCount,
        }))
        .sort((a, b) => b.periodSales - a.periodSales)
        .map((p, i) => ({ rank: i + 1, ...p }));

      const topProduct = ranked[0] || null;
      const totalPeriodSales = ranked.reduce((s, p) => s + p.periodSales, 0);

      report = await Report.create({
        periodNumber: settings.periodNumber,
        startDate: settings.periodStart,
        endDate: settings.periodEnd,
        generatedAt: now,
        topProduct: topProduct
          ? {
              name: topProduct.name,
              sku: topProduct.sku,
              category: topProduct.category,
              periodSales: topProduct.periodSales,
              totalSales: topProduct.totalSales,
              retailPrice: topProduct.retailPrice,
            }
          : null,
        products: ranked,
        totalPeriodSales,
      });

      // Auto-start the next 30-day period using current salesCounts as new snapshot
      const newSnapshot = {};
      products.forEach((p) => {
        newSnapshot[p._id.toString()] = p.salesCount;
      });

      await Settings.findOneAndUpdate(
        {},
        {
          periodNumber: settings.periodNumber + 1,
          periodStart: now,
          periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          salesSnapshot: newSnapshot,
        },
      );
    }

    return res.status(200).json({
      success: true,
      status: "complete",
      report,
    });
  } catch (err) {
    console.error("getReport error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate report." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/reports  (admin only)
// Returns all historical completed reports, newest first.
// ─────────────────────────────────────────────────────────────────────────────
const getAllReports = async (req, res) => {
  try {
    const reports = await Report.find({}).sort({ periodNumber: -1 });
    return res.status(200).json({ success: true, reports });
  } catch (err) {
    console.error("getAllReports error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch reports." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/stats  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [total, totalUsers, outOfStock, categories, topSold] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Product.countDocuments({ stock: 0 }),
      Product.distinct("category"),
      Product.findOne({}).sort({ salesCount: -1 }).select("name salesCount"),
    ]);

    return res.status(200).json({
      success: true,
      totalProducts: total,
      totalUsers,
      total,
      outOfStock,
      inStock: total - outOfStock,
      categories: categories.filter(Boolean).length,
      topSold: topSold
        ? { name: topSold.name, salesCount: topSold.salesCount }
        : null,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch stats." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/products  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const clearProducts = async (req, res) => {
  try {
    const result = await Product.deleteMany({});
    const OutOfStockDeletedProduct = require("../models/OutOfStockDeletedProduct");
    const Category = require("../models/Category");
    await OutOfStockDeletedProduct.deleteMany({});
    await Category.deleteMany({});
    // Only clear the sales snapshot — keep reports and the current period intact
    await Settings.findOneAndUpdate({}, { salesSnapshot: {} });

    // Emit event so frontend can show skeleton state
    const io = req.app.get("io");
    if (io) {
      io.emit("products_cleared", { message: "All products have been cleared by admin." });
    }

    return res.status(200).json({
      success: true,
      message: `All products cleared. ${result.deletedCount} products removed. Reports and tracking period preserved.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("clearProducts error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to clear products." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/:id  (single product detail)
// ─────────────────────────────────────────────────────────────────────────────
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    // Try ObjectId lookup first, then slug lookup
    let product;
    const isValidId = mongoose.Types.ObjectId.isValid(id);
    if (isValidId) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Product.variations is the primary source of truth. It may be missing
    // entirely (fall back to DynamicData for the full list) or partially
    // populated (fill every variant whose price/salePrice/quantity is missing
    // from the DynamicData record). DynamicData is matched by the product's
    // ObjectId ref, slug, OR the HHC productId string.
    const merged = product.toObject ? product.toObject() : { ...product };
    const hasVariations = Array.isArray(merged.variations) && merged.variations.length > 0;
    if (!hasVariations || merged.variations.some((v) => !isVariationPriceable(v) || !isVariationStockable(v))) {
      const lookups = [{ product: merged._id }];
      if (merged.slug) lookups.push({ slug: merged.slug });
      if (merged.productId) lookups.push({ productId: merged.productId });
      const dynamic = await DynamicData.findOne({ $or: lookups }).lean();
      if (dynamic) {
        const dynamicVariations = Array.isArray(dynamic.variations)
          ? dynamic.variations
          : [];
        if (!hasVariations && dynamicVariations.length > 0) {
          // No variants on the product at all → adopt the full list.
          merged.variations = dynamicVariations;
        } else {
          // Partial data → fill every missing field from the matching dynamic
          // variation (matched by HHC variation id, then by index). Fields the
          // dynamic record also lacks are left untouched (never forced to 0).
          merged.variations = merged.variations.map((v, idx) => {
            const src =
              (v?.id !== undefined &&
                v.id !== null &&
                dynamicVariations.find((d) => String(d?.id ?? "") === String(v.id))) ||
              dynamicVariations[idx] ||
              {};
            const hasQty = v?.quantity !== undefined && v?.quantity !== null && !Number.isNaN(Number(v.quantity));
            const srcQty = !!src && src?.quantity !== undefined && src?.quantity !== null && !Number.isNaN(Number(src.quantity));
            const ownPrice =
              v?.price !== undefined && v?.price !== null && !Number.isNaN(Number(v.price)) && Number(v.price) > 0;
            const ownSale =
              v?.salePrice !== undefined && v?.salePrice !== null && !Number.isNaN(Number(v.salePrice)) && Number(v.salePrice) > 0;
            const srcPrice =
              !!src && src?.price !== undefined && src?.price !== null && !Number.isNaN(Number(src.price)) && Number(src.price) > 0;
            const out = { ...v };
            if (!hasQty) out.quantity = srcQty ? src.quantity : out.quantity;
            if (!ownPrice && srcPrice) out.price = src.price;
            if (!ownSale) {
              if (!!src && src?.salePrice !== undefined && src?.salePrice !== null && !Number.isNaN(Number(src.salePrice)) && Number(src.salePrice) > 0) {
                out.salePrice = src.salePrice;
              } else if (!ownPrice && srcPrice) {
                out.salePrice = src.price;
              }
            }
            return out;
          });
        }
        if (
          (!Array.isArray(merged.gallery) || merged.gallery.length === 0) &&
          Array.isArray(dynamic.gallery) &&
          dynamic.gallery.length > 0
        ) {
          merged.gallery = dynamic.gallery;
        }
      }
    }

    // Apply the same markup the catalogue uses (price range → category → global
    // %, e.g. 70%) to EVERY variation's HHC source price, so a variation that
    // costs Rs 20 retails at exactly the same formula as the base product.
    // The markup uses the product's persisted lowPrice classification, matching
    // the product-level retail (computed at import/reprice time), so variation
    // prices agree with the card price whenever the source bases agree.
    // Variations without a source price are left untouched and the customer UI
    // falls back to the product's retail price.
    try {
      const rules = await loadPricingRules();
      if (Array.isArray(merged.variations) && merged.variations.length > 0) {
        merged.variations = merged.variations.map((v) => {
          const base = Number(
            (v?.salePrice ?? v?.price ?? v?.wholesalePrice ?? v?.retailPrice),
          );
          if (!base || base <= 0) return v;
          const priced = priceProductFromRules(base, merged.category, merged.lowPrice === true, rules);
          if (!priced) return v;
          return { ...v, price: priced.retail, salePrice: priced.retail, retailPrice: priced.retail };
        });
      }
    } catch (err) {
      console.error("applyVariationMarkup error:", err?.message);
    }

    return res.status(200).json({ success: true, product: toCustomerProduct(merged) });
  } catch (err) {
    console.error("getProductById error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch product." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/:id/similar
// Returns top 6 similar products by category + name keyword matching + sales.
// ─────────────────────────────────────────────────────────────────────────────
const getSimilarProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const similar = await Product.find({
      _id: { $ne: product._id },
      category: product.category || "Uncategorized",
    })
      .sort({ salesCount: -1, stock: -1, createdAt: -1 })
      .limit(6)
      .lean();

    const safeProducts = similar.map(toCustomerProduct);
    return res.status(200).json({ success: true, products: safeProducts });
  } catch (err) {
    console.error("getSimilarProducts error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch similar products." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/products/:id/stock  (update stock — used by cart add/remove)
// Body: { change: -1 }  (negative = decrease, positive = increase)
// ─────────────────────────────────────────────────────────────────────────────
const updateStock = async (req, res) => {
  invalidateProductListCache();
  try {
    const { change } = req.body;
    if (typeof change !== "number" || change === 0) {
      return res.status(400).json({ success: false, message: "Invalid stock change value." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const newStock = product.stock + change;
    if (newStock < 0) {
      return res.status(400).json({ success: false, message: "Not enough stock available." });
    }

    product.stock = newStock;
    product.stockOutAt = newStock === 0 ? new Date() : null;
    await product.save();

    // Out-of-stock detection
    const io = req.app.get("io");
    if (product.stock === 0) {
      product.pendingDeleteAt = new Date(Date.now() + 2 * 60 * 1000);
      await product.save();
      scheduleDeletion(product._id, io);
      if (io) {
        io.emit("product_out_of_stock", {
          productId: product._id.toString(),
          name: product.name,
          category: product.category,
          stock: product.stock,
        });
      }
    } else if (product.stock > 0 && product.pendingDeleteAt) {
      product.pendingDeleteAt = null;
      await product.save();
      cancelDeletion(product._id);
    }

    return res.status(200).json({ success: true, stock: product.stock });
  } catch (err) {
    console.error("updateStock error:", err);
    return res.status(500).json({ success: false, message: "Failed to update stock." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/products/:id  (admin only)
// Updates a single product's fields.
// ─────────────────────────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  invalidateProductListCache();
  try {
    const allowed = [
      "name", "description", "wholesalePrice", "retailPrice", "stock",
      "imageUrl", "videoUrl", "weight", "sku", "productId",
      "hidden", "keywords", "seoTitle", "seoDescription",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Regenerate slug when name changes
    if (updates.name) {
      updates.slug = await uniqueSlug(slugify(updates.name), req.params.id);
    }

    // Auto-create category if it doesn't exist (collision-safe slug handling)
    if (updates.category) {
      await Category.findOrCreateCategory(updates.category);
    }

    // Apply category pricing only if category actually changed and retailPrice not explicitly sent
    if (updates.category && updates.retailPrice === undefined) {
      const existing = await Product.findById(req.params.id).select("category").lean();
      if (existing && existing.category !== updates.category) {
        const rules = await loadPricingRules();
        const priced = priceProductFromRules(updates.wholesalePrice || 0, updates.category, false, rules);
        if (priced) {
          updates.retailPrice = priced.retail;
          updates.lowPrice = priced.lowPrice;
        }
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Out-of-stock detection when admin sets stock to 0
    const io = req.app.get("io");
    if (product.stock === 0) {
      product.pendingDeleteAt = new Date(Date.now() + 2 * 60 * 1000);
      await product.save();
      scheduleDeletion(product._id, io);
      if (io) {
        io.emit("product_out_of_stock", {
          productId: product._id.toString(),
          name: product.name,
          category: product.category,
          pendingDeleteAt: product.pendingDeleteAt,
        });
      }
    } else if (product.stock > 0 && product.pendingDeleteAt) {
      product.pendingDeleteAt = null;
      await product.save();
      cancelDeletion(product._id);
    }

    // Log the update
    try {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        user: req.user,
        action: "PRODUCT_UPDATED",
        description: `Updated product "${product.name}" (${product._id})`,
        req,
      });
    } catch {}

    return res.status(200).json({ success: true, product });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ success: false, message: "Failed to update product." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/products/:id  (admin only)
// Soft-deletes a product — hidden from storefront and admin list but
// preserved in the database for the "Deleted Products" admin page.
// ─────────────────────────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  invalidateProductListCache();
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { deleted: true, deletedAt: new Date(), hidden: true },
      { new: true },
    );
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    try {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        user: req.user,
        action: "PRODUCT_DELETED",
        description: `Deleted product "${product.name}" (${product._id})`,
        req,
      });
    } catch {}

    const io = req.app.get("io");
    if (io) {
      io.emit("product_deleted", { productId: product._id.toString() });
    }

    return res.status(200).json({ success: true, message: `"${product.name}" has been deleted.` });
  } catch (err) {
    console.error("deleteProduct error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete product." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/deleted  (admin only)
// Lists soft-deleted products for the "Deleted Products" admin page.
// ─────────────────────────────────────────────────────────────────────────────
const getDeletedProducts = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = { deleted: true };
    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { sku: { $regex: escapeRegex(search), $options: "i" } },
        { category: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort({ deletedAt: -1 }).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, products, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error("getDeletedProducts error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch deleted products." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/products/:id/restore  (admin only)
// Restores a soft-deleted product.
// ─────────────────────────────────────────────────────────────────────────────
const restoreProduct = async (req, res) => {
  invalidateProductListCache();
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { deleted: false, deletedAt: null },
      { new: true },
    );
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    try {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        user: req.user,
        action: "PRODUCT_UPDATED",
        description: `Restored deleted product "${product.name}" (${product._id})`,
        req,
      });
    } catch {}

    const io = req.app.get("io");
    if (io) {
      io.emit("products_updated", { source: "restore", productId: product._id.toString() });
    }

    return res.status(200).json({ success: true, message: `"${product.name}" has been restored.` });
  } catch (err) {
    console.error("restoreProduct error:", err);
    return res.status(500).json({ success: false, message: "Failed to restore product." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/update-pricing-by-category  (admin only)
// Bulk updates retailPrice for all products in a category based on a markup
// percentage over wholesalePrice.
// ─────────────────────────────────────────────────────────────────────────────
const updatePricingByCategory = async (req, res) => {
  invalidateProductListCache();
  clearPricingRulesCache();
  try {
    const { category, percentage } = req.body;
    if (!category || percentage === undefined || percentage === null) {
      return res.status(400).json({ success: false, message: "Category and percentage are required." });
    }

    const pct = Number(percentage);
    if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 10000) {
      return res.status(400).json({ success: false, message: "Percentage must be a finite number between 0 and 10000." });
    }

    const products = await Product.find({ category });

    if (!products.length) {
      return res.status(404).json({ success: false, message: `No products found in category "${category}".` });
    }

    const ops = [];
    let skipped = 0;
    // Load rules once before the loop; feed the newly-set category % through
    // so out-of-range products in this category still get the new markup today.
    const rules = await loadPricingRules();
    rules.categoryPricing[category] = pct;
    for (const product of products) {
      const wholesale = product.wholesalePrice;
      if (!wholesale || wholesale <= 0) { skipped++; continue; } // no cost data — never zero out retail
      const priced = priceProductFromRules(product.wholesalePrice, product.category, product.lowPrice === true, rules);
      if (!priced) { skipped++; continue; }
      if (!Number.isFinite(priced.retail) || priced.retail < 0) { skipped++; continue; }
      const newRetail = priced.retail;
      if (newRetail !== product.retailPrice || priced.lowPrice !== (product.lowPrice === true)) {
        ops.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { retailPrice: newRetail, lowPrice: priced.lowPrice } },
          },
        });
      }
    }

    let updated = 0;
    if (ops.length > 0) {
      const result = await Product.bulkWrite(ops);
      updated = result.modifiedCount;
    }

    // Persist category pricing in Settings
    try {
      const settings = await Settings.findOne({});
      const pricing = settings?.categoryPricing
        ? Object.fromEntries(settings.categoryPricing)
        : {};
      pricing[category] = pct;
      await Settings.findOneAndUpdate({}, { categoryPricing: pricing });
    } catch (err) {
      console.error("Failed to persist category pricing:", err);
    }

    try {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        user: req.user,
        action: "PRODUCT_UPDATED",
        description: `Bulk-updated pricing for category "${category}": ${updated}/${products.length} products updated at ${pct}% markup`,
        req,
      });
    } catch {}

    // Emit pricing update event
    const io = req.app.get("io");
    if (io) {
      io.emit("pricing_updated", { category, percentage: pct });
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${updated} of ${products.length} products in "${category}" at ${pct}% markup.`,
      updated,
      total: products.length,
    });
  } catch (err) {
    console.error("updatePricingByCategory error:", err);
    return res.status(500).json({ success: false, message: "Failed to update pricing." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/out-of-stock  (admin only)
// Returns all products that have been deleted due to out-of-stock.
// ─────────────────────────────────────────────────────────────────────────────
const getOutOfStockProducts = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      OutOfStockDeletedProduct.find({})
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      OutOfStockDeletedProduct.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      products,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("getOutOfStockProducts error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch out-of-stock products." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/category-pricing  (admin only)
// Returns saved category pricing percentages.
// ─────────────────────────────────────────────────────────────────────────────
const getCategoryPricing = async (req, res) => {
  try {
    const [settings, categories, counts] = await Promise.all([
      Settings.findOne({}),
      Category.find({}).sort({ name: 1 }).lean(),
      Product.aggregate([
        { $match: { hidden: { $ne: true } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);
    const raw = settings?.categoryPricing;
    const pricing = raw instanceof Map ? Object.fromEntries(raw) : raw ?? {};
    const globalPricing = settings?.globalPricing ?? null;
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    const categoryList = categories.map((c) => ({
      name: c.name,
      productCount: countMap.get(c.name) ?? 0,
      markup: pricing[c.name] ?? globalPricing ?? null,
    }));
    return res.status(200).json({ success: true, pricing, globalPricing, categories: categoryList });
  } catch (err) {
    console.error("getCategoryPricing error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch pricing." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/categories  (admin only)
// Returns all categories.
// ─────────────────────────────────────────────────────────────────────────────
let categoriesCache = null;
let categoriesCacheAt = 0;
const CATEGORIES_CACHE_TTL = 60_000;

const getCategories = async (req, res) => {
  try {
    const now = Date.now();
    if (categoriesCache && now - categoriesCacheAt < CATEGORIES_CACHE_TTL) {
      return res.status(200).json({ success: true, categories: categoriesCache });
    }
    const [categories, counts] = await Promise.all([
      Category.find({}).sort({ name: 1 }).lean(),
      Product.aggregate([
        { $match: { hidden: { $ne: true } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);
    // Live productCount — never trust the stored value, which goes stale as
    // products are imported/recategorized.
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    const withCounts = categories.map((c) => ({
      ...c,
      productCount: countMap.get(c.name) ?? 0,
    }));
    categoriesCache = withCounts;
    categoriesCacheAt = now;
    return res.status(200).json({ success: true, categories: withCounts });
  } catch (err) {
    console.error("getCategories error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch categories." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/categories/update-image  (admin only)
// Sets a category's image URL.
// ─────────────────────────────────────────────────────────────────────────────
const updateCategoryImage = async (req, res) => {
  try {
    const { slug, image } = req.body;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Category slug is required." });
    }
    const category = await Category.findOneAndUpdate(
      { slug },
      { $set: { image: image || "" } },
      { new: true },
    );
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    categoriesCache = null;
    return res.status(200).json({ success: true, category });
  } catch (err) {
    console.error("updateCategoryImage error:", err);
    return res.status(500).json({ success: false, message: "Failed to update category image." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/update-pricing-all  (admin only)
// Applies a markup percentage to ALL products based on wholesalePrice.
// ─────────────────────────────────────────────────────────────────────────────
const updatePricingAll = async (req, res) => {
  invalidateProductListCache();
  clearPricingRulesCache();
  try {
    const { percentage } = req.body;
    if (percentage === undefined || percentage === null) {
      return res.status(400).json({ success: false, message: "Percentage is required." });
    }

    const pct = Number(percentage);
    if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 10000) {
      return res.status(400).json({ success: false, message: "Percentage must be a finite number between 0 and 10000." });
    }

    const [products, rules] = await Promise.all([
      Product.find({}),
      loadPricingRules(),
    ]);

    if (!products.length) {
      return res.status(404).json({ success: false, message: "No products found." });
    }

    // Feed the newly-set global % through so out-of-range products still get
    // the new markup today (range overrides still win for in-range products).
    rules.globalPricing = pct;

    const ops = [];
    let skipped = 0;
    for (const product of products) {
      const wholesale = product.wholesalePrice;
      if (!wholesale || wholesale <= 0) { skipped++; continue; } // no cost data — never zero out retail
      const priced = priceProductFromRules(product.wholesalePrice, product.category, product.lowPrice === true, rules);
      if (!priced) { skipped++; continue; }
      if (!Number.isFinite(priced.retail) || priced.retail < 0) { skipped++; continue; }
      const newRetail = priced.retail;
      if (newRetail !== product.retailPrice || priced.lowPrice !== (product.lowPrice === true)) {
        ops.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { retailPrice: newRetail, lowPrice: priced.lowPrice } },
          },
        });
      }
    }

    let updated = 0;
    if (ops.length > 0) {
      const result = await Product.bulkWrite(ops);
      updated = result.modifiedCount;
    }

    // Persist global pricing in Settings
    try {
      await Settings.findOneAndUpdate({}, { globalPricing: pct });
    } catch (err) {
      console.error("Failed to persist global pricing:", err);
    }

    try {
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        user: req.user,
        action: "PRODUCT_UPDATED",
        description: `Bulk-updated pricing for all products: ${updated}/${products.length} products updated at ${pct}% markup`,
        req,
      });
    } catch {}

    const io = req.app.get("io");
    if (io) {
      io.emit("pricing_updated", { all: true, percentage: pct });
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${updated} of ${products.length} products at ${pct}% markup.${skipped > 0 ? ` (${skipped} skipped — no wholesale cost)` : ""}`,
      updated,
      skipped,
      total: products.length,
    });
  } catch (err) {
    console.error("updatePricingAll error:", err);
    return res.status(500).json({ success: false, message: "Failed to update pricing." });
  }
};

// ── Get all orders for a product across PreOrder, MainOrderCSVData, OrderHistory ──
const getProductOrders = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const sku = (product.sku || "").trim().toLowerCase();
    const name = (product.name || "").trim().toLowerCase();

    const skuOrNameMatch = (entry) => {
      const val = (entry || "").trim().toLowerCase();
      return val && (val === sku || val === name || (sku && val.includes(sku)));
    };

    const preOrders = await PreOrder.find({ "items.product": id })
      .sort({ createdAt: -1 })
      .lean();

    const mainOrders = await MainOrderCSVData.find({
      productSearch: { $regex: sku || name, $options: "i" },
    })
      .sort({ createdAt: -1 })
      .lean()
      .then((orders) =>
        orders.filter((o) =>
          (o.productSearch || []).some((val) => skuOrNameMatch(val))
        )
      );

    const orderHistory = await OrderHistory.find({
      productSearch: { $regex: sku || name, $options: "i" },
    })
      .sort({ createdAt: -1 })
      .lean()
      .then((orders) =>
        orders.filter((o) =>
          (o.productSearch || []).some((val) => skuOrNameMatch(val))
        )
      );

    const combined = [
      ...preOrders.map((o) => ({
        ...o,
        _orderType: "pre_order",
        _stage: "Pre Order",
      })),
      ...mainOrders.map((o) => ({
        ...o,
        _orderType: "main_order",
        _stage: "Main Order",
      })),
      ...orderHistory.map((o) => ({
        ...o,
        _orderType: "order_history",
        _stage: "Delivered",
      })),
    ];

    combined.sort((a, b) => {
      const da = a.createdAt || a.exportedAt || 0;
      const db = b.createdAt || b.exportedAt || 0;
      return new Date(db) - new Date(da);
    });

    return res.status(200).json({ success: true, orders: combined, product });
  } catch (err) {
    console.error("getProductOrders error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/admin-list  (admin only)
// Returns full product documents — including stock, wholesalePrice, hidden — for
// use exclusively in the admin panel. Not sanitised through toCustomerProduct.
// ─────────────────────────────────────────────────────────────────────────────
const getAdminProducts = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 500 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = { deleted: { $ne: true } };
    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { sku: { $regex: escapeRegex(search), $options: "i" } },
        { category: { $regex: escapeRegex(search), $options: "i" } },
        { keywords: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const products = await Product.find(query)
      // Newest first — freshly imported/synced products (and quick-fetch
      // items with no page field) always appear at the top, never buried
      // at the end of the paginated admin list.
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const [total, dynamicRecords] = await Promise.all([
      Product.countDocuments(query),
      DynamicData.find({
        $or: [
          { product: { $in: products.map((p) => p._id) } },
          { productId: { $in: products.map((p) => p.productId || "").filter(Boolean) } },
        ],
      })
        .select("product productId fetchedAt")
        .lean(),
    ]);

    // Attach the dynamic-data fetched status to each product so the admin
    // panel can show the "dynamic data fetched" badge on product cards.
    const dynamicByProduct = new Map();
    const dynamicByHhcId = new Map();
    for (const d of dynamicRecords) {
      if (d.product) dynamicByProduct.set(String(d.product), d);
      if (d.productId) dynamicByHhcId.set(d.productId, d);
    }
    for (const p of products) {
      const match = dynamicByProduct.get(String(p._id)) || dynamicByHhcId.get(p.productId || "");
      p.dynamicDataFetched = !!match;
      p.dynamicDataFetchedAt = match?.fetchedAt || null;
    }

    return res.status(200).json({
      success: true,
      products,
      total,
      page: pageNum,
    });
  } catch (err) {
    console.error("getAdminProducts error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch products." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Groq AI categorization helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ["Electronics", "Fashion", "Home & Kitchen", "Beauty", "Sports", "Toys"];
const GROQ_MODEL      = "llama-3.3-70b-versatile";
const GROQ_BATCH_SIZE = 20;  // products per Groq call

const GROQ_SYSTEM_PROMPT = `You are an expert product category classifier for a Pakistani e-commerce store.

Classify each product into EXACTLY ONE of these 6 categories:

Electronics   → phones, laptops, TVs, earbuds/headphones/AirPods, cameras, chargers, cables, WiFi routers,
                power banks, smartwatches, speakers, drones, gaming consoles, printers, phone/laptop coolers,
                cordless drills, inverters, UPS, solar panels, washing machines, refrigerators, ACs, microwave ovens.

Fashion       → clothing (shirts, jeans, dresses, kurtas, abayas), shoes/sneakers/sandals, handbags, wallets,
                caps/hats, sunglasses, jewellery, watches, scarves, belts, socks, gloves.

Home & Kitchen → kitchen appliances (air fryer, kettle, blender, rice cooker, coffee maker, sandwich maker,
                egg boiler, juicer, food chopper), cookware (pans, pots, woks), cutlery & utensils,
                food storage, dining ware, humidifiers, aroma diffusers, lamps (desk/floor/table/night/reading),
                home decor (showpieces, candles, vases, wall art, frames), furniture (chairs, tables, shelves),
                bedding & cushions, cleaning tools (mops, brooms), pest control (mosquito nets, mousetraps, rat traps),
                bathroom accessories, door/window seals, storage organizers, steam irons, neck/handheld fans.

Beauty        → skincare (face wash, moisturizer, serum, toner, sunscreen, face mask, peel-off mask,
                blackhead remover, dark spot corrector, de-tan, body scrub, glycolic/salicylic/niacinamide),
                haircare (shampoo, conditioner, hair oil, hair mask, hair dye/color, hair spray, hair gel,
                hair soap, dry shampoo, hair dryer, hot air brush, straightener, curling iron),
                makeup (lipstick, lip gloss, foundation, mascara, eyeshadow, eyeliner, blush, highlighter,
                nail polish, manicure/pedicure set, makeup brushes, setting spray, primer),
                fragrances (perfume, eau de parfum, eau de toilette, extrait de parfum, deodorant, body spray, attar),
                body care (body lotion, body wash, wax/hair removal powder, epilator, sweat pads,
                intimate wash, scar gel, stretch mark cream, belly/slimming patches),
                grooming devices (electric shaver, beard trimmer, nose trimmer, facial massager,
                EMS/microcurrent device, lice comb), eyelash extensions, nail kits.

Sports        → gym/fitness equipment (dumbbells, barbells, resistance bands, pull-up bars, ab rollers,
                treadmill, exercise bike, mini pedal exerciser), yoga mats & accessories, foam rollers,
                massage guns & percussion massagers, hand grippers & grip strengtheners,
                sports gear (cricket bat/ball/kit, football, basketball, badminton, boxing gloves, tennis),
                cycling (bikes, helmets), camping & hiking (tents, sleeping bags, hiking backpacks),
                swimming goggles, protein supplements, whey protein.

Toys          → children's toys (toddler/baby/kids toys), RC cars, action figures, dolls, stuffed animals,
                building blocks, board games, jigsaw puzzles, fidget toys, slime kits, water guns,
                kites, kids bicycles/tricycles, toy kitchen/doctor sets, musical toys for kids.

RULES:
- Perfume, cologne, deodorant, body spray, attar → ALWAYS Beauty.
- Massage guns, grip trainers, exercise bikes → ALWAYS Sports.
- Hair dryers, straighteners, curlers, hot air brushes → ALWAYS Beauty.
- Kitchen scales, food scales → Home & Kitchen.
- Portable/handheld/neck fans → Home & Kitchen (not Electronics).
- Shavers and trimmers → Beauty (not Electronics).
- If truly ambiguous, prefer: Beauty > Home & Kitchen > Electronics.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask Groq to classify one batch of products.
 * Returns string[] of category names in the same order as `batch`.
 * Uses the smart key pool (rotation across healthy keys, throttled keys get
 * cooldowns, garbage responses regenerate on another key).
 */
async function groqClassifyBatch(batch, apiKey) {
  const productLines = batch
    .map((p, i) => {
      const name = (p.name || "").trim();
      const desc = (p.description || "").trim().substring(0, 500);
      return `${i + 1}. NAME: ${name}\n   DESCRIPTION: ${desc || "(no description)"}`;
    })
    .join("\n\n");

  const userPrompt =
    `Classify the following ${batch.length} products. ` +
    `Reply with ONLY a valid JSON array of exactly ${batch.length} category strings in the same order.\n` +
    `Example for 3 products: ["Electronics","Beauty","Home & Kitchen"]\n\n` +
    productLines;

  const params = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: GROQ_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: batch.length * 12 + 30,
  };

  const parse = (raw) => {
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error(`Non-JSON response: ${raw.substring(0, 120)}`);
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== batch.length) {
      throw new Error(`Got ${parsed.length} results for ${batch.length} products`);
    }
    return parsed.map((cat) =>
      VALID_CATEGORIES.includes(cat) ? cat : "Uncategorized"
    );
  };

  if (apiKey) {
    // Legacy single-key path (kept for callers that pass a key explicitly)
    const groq = new Groq({ apiKey });
    for (let attempt = 0; attempt <= 5; attempt++) {
      try {
        const chat = await groq.chat.completions.create(params);
        return parse((chat.choices[0]?.message?.content || "").trim());
      } catch (err) {
        const isRateLimit =
          err?.status === 429 ||
          err?.error?.type === "rate_limit_exceeded" ||
          (err?.message || "").toLowerCase().includes("rate limit");
        if (isRateLimit && attempt < 5) {
          await sleep(Math.pow(2, attempt) * 2000);
          continue;
        }
        throw err;
      }
    }
  }

  return groqKeyPool.chatWithRetry("categories", params, {
    parse,
    budget: 300_000,
    split: (p) => groqKeyPool.splitBatchParams(p, batch, (sub) => {
      const lines = sub
        .map((x, i) => {
          const name = (x.name || "").trim();
          const desc = (x.description || "").trim().substring(0, 500);
          return `${i + 1}. NAME: ${name}\n   DESCRIPTION: ${desc || "(no description)"}`;
        })
        .join("\n\n");
      return (
        `Classify the following ${sub.length} products. ` +
        `Reply with ONLY a valid JSON array of exactly ${sub.length} category strings in the same order.\n` +
        `Example for 3 products: ["Electronics","Beauty","Home & Kitchen"]\n\n` +
        lines
      );
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Recategorize in-memory state — polled by /recategorize-status
// ─────────────────────────────────────────────────────────────────────────────
const recategorizeState = {
  running: false,
  processed: 0,
  total: 0,
  updated: 0,
  unchanged: 0,
  done: false,
  error: null,
  logs: [],
};

function resetRecategorizeState() {
  recategorizeState.running = false;
  recategorizeState.processed = 0;
  recategorizeState.total = 0;
  recategorizeState.updated = 0;
  recategorizeState.unchanged = 0;
  recategorizeState.done = false;
  recategorizeState.error = null;
  recategorizeState.logs = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Groq pipeline: AI re-categorization + SEO copy optimization.
// Used by POST /recategorize-all AND the Grand Sync (Phase 3).
// addLog(type, message, extra) streams progress; isAborted() is polled
// between batches so a Grand Sync stop also halts this phase.
// ─────────────────────────────────────────────────────────────────────────────
async function runRecategorizeAndOptimize({ addLog, io, isAborted }) {
  // 1. Ensure category documents exist
  addLog("info", "Ensuring categories exist in database…");
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate(
      { slug: cat.slug },
      { $setOnInsert: { name: cat.name, slug: cat.slug } },
      { upsert: true, new: true }
    );
  }

  // 2. Load every product into memory (name + description + current category)
  addLog("info", "Loading all products…");
  const allProducts = await Product.find({})
    .select("_id name description category")
    .lean();

  const total = allProducts.length;
  recategorizeState.total = total;
  addLog(
    "info",
    `Loaded ${total} products. Classifying with Groq AI (${GROQ_MODEL}), batch size ${GROQ_BATCH_SIZE}…`,
    { total }
  );

  // 3. Build batches — big-first wave drains every key's empty token window
  //    in one call, then normal-sized batches flow at per-key wall speed.
  const concurrency = Math.max(4, Math.min(32, await groqKeyPool.healthyCount()));
  const batches = [];
  {
    const BIG = 24; // copy-optimize ≈ 300 tok/product; 24 × 300 < 8k output cap
    let i = 0;
    for (; i < allProducts.length && batches.length < concurrency; i += BIG) {
      batches.push(allProducts.slice(i, i + BIG));
    }
    for (; i < allProducts.length; i += GROQ_BATCH_SIZE) {
      batches.push(allProducts.slice(i, i + GROQ_BATCH_SIZE));
    }
  }

  let processed = 0;
  let updated   = 0;
  let unchanged = 0;

  // 4. Process with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    if (isAborted && isAborted()) break;
    const chunk = batches.slice(i, i + concurrency);

    await Promise.all(
      chunk.map(async (batch) => {
        let categories;
        try {
          categories = await groqClassifyBatch(batch);
        } catch (err) {
          addLog(
            "warn",
            `Batch failed (${(err.message || "").substring(0, 80)}) — falling back to keyword classifier for ${batch.length} products.`
          );
          categories = batch.map((p) => categorizeProduct(p.name, p.description));
        }

        const optimizedBatch = await optimizeProductCopy(batch, undefined);

        // Bulk-write only the changed products
        const bulkOps = [];
        for (let j = 0; j < batch.length; j++) {
          const p      = batch[j];
          const newCat = categories[j];
          const newName = optimizedBatch[j]?.name || p.name || "";
          const newDescription = optimizedBatch[j]?.description || p.description || "";
          if (newName !== p.name || newCat !== p.category || newDescription !== p.description) {
            bulkOps.push({
              updateOne: {
                filter: { _id: p._id },
                update: {
                  $set: {
                    name: newName,
                    slug: slugify(newName) || p.slug,
                    category: newCat,
                    description: newDescription,
                  },
                },
              },
            });
            updated++;
          } else {
            unchanged++;
          }
          processed++;
        }
        if (bulkOps.length) await Product.bulkWrite(bulkOps);

        recategorizeState.processed = processed;
        recategorizeState.updated   = updated;
        recategorizeState.unchanged = unchanged;

        const pct = Math.round((processed / total) * 100);
        addLog(
          "progress",
          `${processed} / ${total} — ${updated} reassigned/optimized (${pct}%)`,
          { processed, total, updated, unchanged, pct }
        );
      })
    );
  }

  // 5. Refresh category counts
  addLog("info", "Updating category product counts…");
  for (const cat of CATEGORIES) {
    const count = await Product.countDocuments({ category: cat.name });
    await Category.updateOne({ slug: cat.slug }, { $set: { productCount: count } });
  }

  if (io) io.emit("products_updated", { source: "recategorize", updated });

  return { updated, unchanged, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/recategorize-keywords  (admin only)
// Re-categorizes all products using keyword-based classifier (no Groq needed).
// Fast, no API keys required. Use this to fix existing products.
// ─────────────────────────────────────────────────────────────────────────────
const recategorizeAllKeywords = async (req, res) => {
  invalidateProductListCache();
  
  const addLog = (type, message, extra = {}) => {
    console.log(`[keywords-recat] ${type}: ${message}`, extra);
  };

  try {
    addLog("info", "Starting keyword-based re-categorization…");
    
    const allProducts = await Product.find({}).select("_id name description category").lean();
    const total = allProducts.length;
    addLog("info", `Loaded ${total} products`);

    let updated = 0;
    let unchanged = 0;
    const bulkOps = [];

    for (const p of allProducts) {
      const newCat = categorizeProduct(p.name || "", p.description || "");
      if (newCat !== p.category) {
        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { category: newCat } },
          },
        });
        updated++;
      } else {
        unchanged++;
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      addLog("info", `Bulk updated ${bulkOps.length} products`);
    }

    // Ensure category documents exist
    for (const cat of CATEGORIES) {
      await Category.findOneAndUpdate(
        { slug: cat.slug },
        { $setOnInsert: { name: cat.name, slug: cat.slug } },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Re-categorization complete. ${updated} updated, ${unchanged} unchanged.`,
      updated,
      unchanged,
      total,
    });
  } catch (err) {
    console.error("recategorizeAllKeywords error:", err);
    return res.status(500).json({ success: false, message: "Re-categorization failed: " + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products/recategorize-all  (admin only)
// Responds immediately then runs in the background.
// Poll /recategorize-status for live progress.
// ─────────────────────────────────────────────────────────────────────────────
const recategorizeAll = async (req, res) => {
  invalidateProductListCache();
  if (recategorizeState.running) {
    return res
      .status(409)
      .json({ success: false, message: "Re-categorization already in progress." });
  }

  const { dynamicSyncState } = require("./dynamicDataController");
  if (dynamicSyncState.running) {
    return res.status(409).json({
      success: false,
      message: "Grand Sync is running — it already includes re-categorization & SEO optimization.",
    });
  }

  const groqAvailable = await groqKeyPool.hasKeys();
  if (!groqAvailable) {
    return res
      .status(500)
      .json({ success: false, message: "No Groq API keys configured. Set them in Admin → Settings." });
  }

  resetRecategorizeState();
  recategorizeState.running = true;

  const io = req.app.get("io");
  const addLog = (type, message, extra = {}) => {
    const entry = { type, message, time: new Date().toLocaleTimeString(), ...extra };
    recategorizeState.logs.push(entry);
    if (recategorizeState.logs.length > 500) recategorizeState.logs.shift();
    if (io) io.emit("recategorize_progress", entry);
    return entry;
  };

  // Respond immediately — heavy processing runs in background
  res.json({ success: true, message: "AI re-categorization started." });

  (async () => {
    try {
      const { updated, unchanged, total } = await runRecategorizeAndOptimize({
        addLog,
        io,
      });

      recategorizeState.running = false;
      recategorizeState.done    = true;
      addLog(
        "done",
        `All done! ${updated} products reassigned/optimized, ${unchanged} already correct.`,
        { updated, unchanged, total }
      );
    } catch (err) {
      recategorizeState.running = false;
      recategorizeState.error   = err.message;
      addLog("error", `Fatal error: ${err.message}`);
      console.error("recategorizeAll error:", err);
    }
  })();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/recategorize-status  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const getRecategorizeStatus = (req, res) => {
  return res.json({ success: true, ...recategorizeState });
};

const getFeaturedLanding = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 200);
    const listKey = req.originalUrl;
    const cached = getCachedList(listKey);
    if (cached) {
      return listCacheControl(res).status(200).json(cached);
    }
    // Admin-set order first: featuredOrder ascending with null/missing last,
    // tiebroken by updatedAt desc. The $ifNull maps missing orders to the
    // largest number so they sort last — and lets the $limit run in Mongo.
    const products = await Product.aggregate([
      { $match: { featuredOnLanding: true, hidden: { $ne: true } } },
      {
        $project: {
          ...LIST_PROJECTION,
          _sortOrder: { $ifNull: ["$featuredOrder", Number.MAX_SAFE_INTEGER] },
        },
      },
      { $sort: { _sortOrder: 1, updatedAt: -1 } },
      { $limit: limit },
    ]);
    const safeProducts = products.map(toCustomerProduct);
    const payload = { success: true, products: safeProducts };
    setCachedList(listKey, payload);
    return listCacheControl(res).status(200).json(payload);
  } catch (err) {
    console.error("getFeaturedLanding error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch featured products." });
  }
};

const toggleFeaturedLanding = async (req, res) => {
  invalidateProductListCache();
  try {
    const { featured } = req.body;
    if (typeof featured !== "boolean") {
      return res.status(400).json({ success: false, message: "featured must be a boolean." });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { featuredOnLanding: featured },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    const count = await Product.countDocuments({ featuredOnLanding: true });
    return res.status(200).json({ success: true, product, count });
  } catch (err) {
    console.error("toggleFeaturedLanding error:", err);
    return res.status(500).json({ success: false, message: "Failed to toggle featured status." });
  }
};

const getFeaturedCount = async (req, res) => {
  try {
    const count = await Product.countDocuments({ featuredOnLanding: true });
    return res.status(200).json({ success: true, count });
  } catch (err) {
    console.error("getFeaturedCount error:", err);
    return res.status(500).json({ success: false, message: "Failed to get featured count." });
  }
};

const setFeaturedOrder = async (req, res) => {
  invalidateProductListCache();
  const order = req.body?.order;
  if (!Array.isArray(order)) {
    return res.status(400).json({ success: false, message: "order must be an array of product ids" });
  }
  if (order.length > 500) {
    return res.status(400).json({ success: false, message: "order too large" });
  }
  for (const id of order) {
    if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ success: false, message: `invalid product id: ${id}` });
    }
  }
  // The passed array is the COMPLETE ordering: unlisted featured products lose
  // their order (they still stay featured, but sort after the ordered ones).
  const ops = [
    { updateMany: { filter: { featuredOnLanding: true }, update: { $set: { featuredOrder: null } } } },
  ];
  order.forEach((id, i) => {
    ops.push({ updateOne: { filter: { _id: id }, update: { $set: { featuredOrder: i + 1, featuredOnLanding: true } } } });
  });
  await Product.bulkWrite(ops);
  return res.json({ success: true, count: order.length });
};

// ── Update single product manual position ─────────────────────────────────
const updateProductManualPosition = async (req, res) => {
  try {
    const { productId } = req.params;
    const { position } = req.body;

    if (typeof position !== 'number' || position < 0) {
      return res.status(400).json({ success: false, message: 'Position must be a non-negative number' });
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { manualPosition: position },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, product });
  } catch (err) {
    console.error('Error updating manual position:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Bulk update multiple products manual positions ─────────────────────────
const updateBulkManualPositions = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { productId, position }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Updates array is required' });
    }

    const ops = updates.map(({ productId, position }) => ({
      updateOne: {
        filter: { _id: productId },
        update: { $set: { manualPosition: position } }
      }
    }));

    const result = await Product.bulkWrite(ops);
    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error updating bulk manual positions:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Clear all manual positions (reset to default ordering) ───────────────────
const clearAllManualPositions = async (req, res) => {
  try {
    const result = await Product.updateMany(
      {},
      { $unset: { manualPosition: "" } }
    );

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error clearing manual positions:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadCSV,
  createManualProduct,
  getProducts,
  getSuggestions,
  getTrendingSearches,
  getLeaderboard,
  getReport,
  getStats,
  clearProducts,
  getProductById,
  getSimilarProducts,
  updateStock,
  updateProduct,
  deleteProduct,
  getDeletedProducts,
  restoreProduct,
  updatePricingByCategory,
  updatePricingAll,
  getOutOfStockProducts,
  getCategoryPricing,
  getCategories,
  updateCategoryImage,
  getAllReports,
  getProductOrders,
  getAdminProducts,
  recategorizeAll,
  recategorizeAllKeywords,
  getRecategorizeStatus,
  runRecategorizeAndOptimize,
  recategorizeState,
  getFeaturedLanding,
  toggleFeaturedLanding,
  getFeaturedCount,
  setFeaturedOrder,
  productAvailability,
  updateProductManualPosition,
  updateBulkManualPositions,
  clearAllManualPositions,
};

