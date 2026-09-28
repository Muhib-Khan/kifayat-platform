const mongoose = require("mongoose");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const OrderHistory = require("../models/OrderHistory");
const PreOrder = require("../models/PreOrder");
const Order = require("../models/Order");
const Settings = require("../models/Settings");
const User = require("../models/User");
const Product = require("../models/Product");
const { logActivity, ACTIONS } = require("../utils/activityLogger");
const {
  isNumericString,
  matchVariation,
  buildHhcCSVProductFields,
} = require("../utils/hhcExport");

// Base HHC CSV columns (product fields are generated dynamically)
const BASE_CSV_COLUMNS = [
  "orderID", "name", "address", "shpType", "courierCompany", "courierCity",
  "phoneNumber", "phoneNumber2", "sellPrice", "businessProfiles",
  "courierInstruction",
];

// HHC's bulk-order importer reads a fixed set of product slots
// (product1..productN, variation1..variationN, qty1..qtyN). If a column is
// missing from the header it aborts with "Undefined array key productN", so
// the CSV must always contain the full slot range — pad with empty values for
// orders that have fewer items.
const MIN_PRODUCT_COLUMNS = 3;

// HHC's bulk-order importer expects the business profile ID (a number) in the
// businessProfiles column. Kifayat's business id in the courier system.
const BUSINESS_PROFILE_ID = "71823";

// Fallback used by the pre-order CSV when a record has no businessProfiles.
// Matches the same numeric profile id the main CSV always emits.
const BUSINESS_PROFILE_DEFAULT = BUSINESS_PROFILE_ID;

// Courier used for every order — the CSV's courierCompany column is always
// "Trax", matching HHC's own sample bulk-order file exactly (case-sensitive).
const COURIER_COMPANY = "Trax";
const toBusinessProfileName = (v) => {
  // Kept only for the OrderHistory archive's businessProfileName reference
  // field. HHC's sample uses the numeric profile id, so the CSV always uses
  // the number below and this helper is not used for CSV output.
  const s = String(v ?? "").trim();
  if (s && !/^\d+$/.test(s)) return s;
  return "Kifayat";
};

// HHC's sample file encodes allowToOpen as `1` (allow) or empty (don't allow).
// The checkout stores "Yes"/"No" — map them to HHC's format.
const toAllowToOpen = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return ["yes", "true", "1"].includes(s) ? "1" : "";
};

const escapeCSV = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Shared value mapping for HHC CSV rows. Aligns stored values with the format
// HHC's own sample file uses (businessProfiles = numeric id, allowToOpen = 1/empty).
const csvValue = (o, col) => {
  if (col === "shpType") return "Regular";
  if (col === "businessProfiles") return BUSINESS_PROFILE_ID;
  if (col === "courierCompany") return COURIER_COMPANY;
  if (col === "allowToOpen") return toAllowToOpen(o[col]);
  return o[col] ?? "";
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/export-csv/count
// Returns the number of orders currently queued for CSV export (not yet exported).
// Safe to call repeatedly — does not mutate any data.
// ─────────────────────────────────────────────────────────────────────────────
const getCSVQueueCount = async (req, res) => {
  try {
    const count = await MainOrderCSVData.countDocuments({});
    return res.status(200).json({ success: true, count });
  } catch (err) {
    console.error("getCSVQueueCount error:", err);
    return res.status(500).json({ success: false, message: "Failed to get queue count." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/export-csv
// 1. Atomically claim all records currently in MainOrderCSVData by their _id
// 2. Generate HHC-formatted CSV
// 3. Archive claimed orders to OrderHistory
// 4. Delete claimed orders from MainOrderCSVData
// 5. Stream the CSV file to the admin
//
// Design notes:
//  - We snapshot the set of _ids FIRST, then only operate on those exact rows.
//    This avoids the race where a concurrent request sets more rows to
//    exported=true between our updateMany and our find().
//  - We never early-return based on the `exported` flag because a previously
//    failed export could have left records stuck with exported=true. Instead
//    we always check for any records in the collection.
// ─────────────────────────────────────────────────────────────────────────────
const downloadMainCSV = async (req, res) => {
  try {
    // Step 1: Snapshot all records currently in the collection.
    // Lean() for speed — we only need the raw docs.
    const rawOrders = await MainOrderCSVData.find({}).lean();

    // Optional courierCity query override: when the admin picks a courier city
    // in the export UI, every CSV row's courierCity column carries that city
    // (courierCompany is always "Trax"). Falls back to the order's stored city.
    const courierCityOverride = String(req.query.courierCity || "").trim();

    if (rawOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No new orders to export. All orders have been processed.",
        count: 0,
      });
    }

    // ── Dedup against already-archived records (crash-safe) ─────────────────
    // Records are archived (OrderHistory) BEFORE they are deleted from
    // MainOrderCSVData. If the request dies in between, the next download sees
    // the same records again. The MainOrderCSVData.orderID is rewritten to a
    // fresh KO-xxxx per download, so dedup must key on the STABLE source id
    // (_sourceOrderID). Archived leftovers are cleaned up without re-shipping
    // them to HHC or awarding loyalty points twice.
    const freshSourceIds = rawOrders.map((o) => String(o._sourceOrderID || o.orderID || ""));
    const alreadyArchived = freshSourceIds.length
      ? await OrderHistory.find({ sourceOrderID: { $in: freshSourceIds } })
          .select("sourceOrderID")
          .lean()
      : [];
    const archivedSourceSet = new Set(alreadyArchived.map((d) => d.sourceOrderID));

    const duplicateIds = rawOrders
      .filter((o) => archivedSourceSet.has(String(o._sourceOrderID || o.orderID)))
      .map((o) => o._id);
    if (duplicateIds.length > 0) {
      await MainOrderCSVData.deleteMany({ _id: { $in: duplicateIds } }).catch((err) =>
        console.error("[CSV] Failed to clean up already-archived leftovers:", err)
      );
    }
    const exportable = rawOrders.filter(
      (o) => !archivedSourceSet.has(String(o._sourceOrderID || o.orderID))
    );
    if (exportable.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No new orders to export. All orders have been processed.",
        count: 0,
      });
    }
    // Only operate on the exportable snapshot from here on.
    const orders = exportable;

    // ── Resolve the REAL HHC product/variation ids for every line ────────────
    // Runs here at download time as a safety net: records written before the
    // enrichment (product${i} = sku, variation${i} = label) are converted to
    // the real HHC Product ID / HHC Variation ID so the CSV is always
    // uploadable to HHC without manual editing. Resolved values are persisted
    // back onto the record so the OrderHistory archive keeps them too.
    const resolutionSkus = new Set();
    const resolutionPids = new Set();
    const resolutionNames = new Set();
    orders.forEach((o) => {
      const count = Number(o.productCount) || 0;
      for (let i = 1; i <= count; i++) {
        const pid = o[`product${i}`];
        const sku = o[`productSku${i}`] || (!isNumericString(pid) ? pid : "");
        if (sku) resolutionSkus.add(String(sku));
        if (isNumericString(pid) && pid) resolutionPids.add(String(pid));
        // Records written before enrichment only carry the product NAME —
        // resolve those against the catalog by name as a last resort.
        const pname = o[`productName${i}`];
        if (pname) resolutionNames.add(String(pname).trim().toLowerCase());
      }
    });
    const resolvedDocs = await Product.find({
      $or: [
        ...(resolutionSkus.size ? [{ sku: { $in: [...resolutionSkus] } }] : []),
        ...(resolutionPids.size ? [{ productId: { $in: [...resolutionPids] } }] : []),
        // `name` is stored title-cased — match case-insensitively via anchored
        // regexes so the trimmed/lowercased record names resolve to the product.
        ...(resolutionNames.size
          ? [
              {
                name: {
                  $in: [...resolutionNames].map(
                    (n) =>
                      new RegExp(
                        "^" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                        "i",
                      ),
                  ),
                },
              },
            ]
          : []),
      ],
    })
      .select("_id sku name productId imageUrl retailPrice variations")
      .lean();
    const productsBySku = new Map();
    const productsByPid = new Map();
    const productsByName = new Map();
    resolvedDocs.forEach((p) => {
      if (p.sku) productsBySku.set(String(p.sku), p);
      if (p.productId) productsByPid.set(String(p.productId), p);
      const n = String(p.name || "").trim().toLowerCase();
      if (n) productsByName.set(n, p);
    });

    const resolutionWrites = [];
    orders.forEach((o) => {
      const count = Number(o.productCount) || 0;
      const set = {};
      for (let i = 1; i <= count; i++) {
        const rawPid = o[`product${i}`] !== undefined ? String(o[`product${i}`]) : "";
        const rawVid = o[`variation${i}`] !== undefined ? String(o[`variation${i}`]) : "";
        const sku = o[`productSku${i}`] || (!isNumericString(rawPid) ? rawPid : "");
        const label = o[`variationName${i}`] || "";

        let product = isNumericString(rawPid) && rawPid
          ? productsByPid.get(rawPid)
          : null;
        if (!product && sku) product = productsBySku.get(String(sku)) || null;
        if (!product && !isNumericString(rawPid) && rawPid)
          product = productsBySku.get(String(rawPid)) || null;
        if (!product && o[`productName${i}`])
          product =
            productsByName.get(String(o[`productName${i}`]).trim().toLowerCase()) ||
            null;

        // Product column → always the real HHC Product ID (or empty)
        const hhcPid = product?.productId ? String(product.productId) : "";
        const finalPid = isNumericString(rawPid) ? rawPid : hhcPid;
        if (rawPid !== finalPid) {
          o[`product${i}`] = finalPid;
          set[`product${i}`] = finalPid;
        }

        // Variation column → always the real HHC Variation ID (or empty)
        let finalVid = isNumericString(rawVid) ? rawVid : "";
        let resolvedVariant = null;
        if (!finalVid && product) {
          resolvedVariant = matchVariation(product, label || rawVid);
          if (resolvedVariant && resolvedVariant.id !== undefined && resolvedVariant.id !== null) {
            finalVid = String(resolvedVariant.id);
          }
        }
        if (rawVid !== finalVid) {
          o[`variation${i}`] = finalVid;
          set[`variation${i}`] = finalVid;
        }

        if (product) {
          if (product.sku && sku !== String(product.sku)) {
            o[`productSku${i}`] = String(product.sku);
            set[`productSku${i}`] = String(product.sku);
          }
          if (product.name && !o[`productName${i}`]) {
            o[`productName${i}`] = String(product.name);
            set[`productName${i}`] = String(product.name);
          }
          if (resolvedVariant && resolvedVariant.name && !o[`variationName${i}`]) {
            o[`variationName${i}`] = String(resolvedVariant.name);
            set[`variationName${i}`] = String(resolvedVariant.name);
          }
          if (
            (o[`productPrice${i}`] === undefined || o[`productPrice${i}`] === null) &&
            product.retailPrice
          ) {
            o[`productPrice${i}`] = Number(product.retailPrice);
            set[`productPrice${i}`] = Number(product.retailPrice);
          }
        }
      }
      if (Object.keys(set).length > 0) {
        resolutionWrites.push({
          updateOne: { filter: { _id: o._id }, update: { $set: set } },
        });
      }
    });
    if (resolutionWrites.length > 0) {
      await MainOrderCSVData.bulkWrite(resolutionWrites);
    }

    // ── Assign custom order IDs (KO-00000001, ...) ──────────────────────────
    // One sequential id per ORDER ROW (the HHC Bulk Order CSV has a single
    // orderID column per row). Runs only here, at download time, continuing
    // from the last assigned id so consecutive exports never repeat. The
    // counter is persisted in the Settings doc and the id is written back onto
    // the main order record.
    const orderCount = orders.length;
    let idCursor = 0;
    if (orderCount > 0) {
      const settings = await Settings.findOneAndUpdate(
        {},
        { $inc: { mainCSVCustomOrderId: orderCount } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      idCursor = (settings?.mainCSVCustomOrderId ?? orderCount) - orderCount;

      const idWrites = [];
      orders.forEach((o) => {
        idCursor += 1;
        const customId = `KO-${String(idCursor).padStart(4, "0")}`;
        o._sourceOrderID = o._sourceOrderID || o.orderID;
        o.orderID = customId;
        idWrites.push({
          updateOne: {
            filter: { _id: o._id },
            update: { $set: { orderID: customId, _sourceOrderID: o._sourceOrderID } },
          },
        });
      });
      if (idWrites.length > 0) {
        await MainOrderCSVData.bulkWrite(idWrites);
      }
    }

    // Step 2: Atomically mark ONLY the records we just captured as exported,
    // using their _ids. Any records inserted after our snapshot are not touched.
    const capturedIds = orders.map((o) => o._id);
    await MainOrderCSVData.updateMany(
      { _id: { $in: capturedIds } },
      { $set: { exported: true } },
    );

    // Step 3: Determine max products across all orders to build dynamic columns
    const maxProducts = Math.max(
      MIN_PRODUCT_COLUMNS,
      orders.reduce((max, o) => {
        const count = o.productCount || 0;
        return count > max ? count : max;
      }, 0),
    );

    // HHC Bulk Order CSV structure — dynamic product columns following the
    // exact naming convention (productN, variationN, qtyN). The template only
    // shows product1..3 but any number of products simply extends the columns.
    const productColumns = [];
    for (let i = 1; i <= maxProducts; i++) {
      productColumns.push(`product${i}`, `variation${i}`, `qty${i}`);
    }

    const allColumns = [...BASE_CSV_COLUMNS, ...productColumns, "shipping", "allowToOpen"];

    const header = allColumns.join(",");
    const rows = orders.map((o) =>
      allColumns.map((col) => {
        if (col === "courierCity" && courierCityOverride) return escapeCSV(courierCityOverride);
        return escapeCSV(csvValue(o, col));
      }).join(","),
    );
    const csv = [header, ...rows].join("\r\n") + "\r\n";

    // Step 4: Archive to OrderHistory with email from PreOrder, enriched with
    // the full shipment fields, the resolved product data (real HHC ids) for
    // every product line, and a snapshot of the customer/user account that
    // placed the order.
    const sourceOrderIds = orders.map((o) => o._sourceOrderID || o.orderID);
    const preOrders = await PreOrder.find({
      order: {
        $in: sourceOrderIds
          .filter((id) => mongoose.isValidObjectId(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      },
    }).lean();
    const emailMap = {};
    preOrders.forEach((po) => {
      if (po.order) emailMap[po.order.toString()] = po.email || "";
    });

    // ── Resolve users (by stored user ref / email) for the archive snapshot ──
    const userRefs = orders.map((o) => o.user).filter((u) => u && mongoose.isValidObjectId(u));
    const userEmails = orders
      .map((o) => String(o.userEmail || emailMap[o._sourceOrderID || o.orderID] || "").trim().toLowerCase())
      .filter(Boolean);
    const [usersById, usersByEmail] = await Promise.all([
      userRefs.length
        ? User.find({ _id: { $in: userRefs } }).select("_id name email phone tier role").lean()
        : [],
      userEmails.length
        ? User.find({ email: { $in: userEmails } }).select("_id name email phone tier role").lean()
        : [],
    ]);
    const userById = new Map(usersById.map((u) => [String(u._id), u]));
    const userByEmail = new Map(usersByEmail.map((u) => [u.email.toLowerCase(), u]));

    const historyDocs = orders.map((o) => {
      // Key the email fallback on the STABLE _sourceOrderID — o.orderID has
      // already been rewritten to the fresh KO-xxxx id at this point, so
      // emailMap (keyed by the original order id) would never match.
      const email = String(o.userEmail || emailMap[o._sourceOrderID || o.orderID] || "").trim().toLowerCase();
      const resolvedUser =
        (o.user && userById.get(String(o.user))) ||
        (email && userByEmail.get(email)) ||
        null;

      const doc = {
        exportedAt: new Date(),
        orderID: o.orderID,
        sourceOrderID: o._sourceOrderID || o.orderID,
        name: o.name,
        address: o.address,
        shpType: "Regular",
        courierCompany: COURIER_COMPANY,
        courierCity: courierCityOverride || o.courierCity,
        phoneNumber: o.phoneNumber,
        phoneNumber2: o.phoneNumber2 || "",
        sellPrice: o.sellPrice,
        // Keep the numeric profile id (schema is Number-typed); carry the
        // resolved profile NAME for reference in a dedicated field.
        businessProfiles: BUSINESS_PROFILE_ID,
        businessProfileName: toBusinessProfileName(BUSINESS_PROFILE_ID),
        courierInstruction: o.courierInstruction || "",
        shipping: o.shipping,
        allowToOpen: o.allowToOpen || "",
        confirmationToken: o.confirmationToken || "",
        email,
        // Complete shipment data — every field carried by the main-order record
        latitude: o.latitude ?? null,
        longitude: o.longitude ?? null,
        // User snapshot — the customer account that placed the order
        user: resolvedUser
          ? {
              userId: String(resolvedUser._id),
              name: resolvedUser.name || "",
              email: resolvedUser.email || "",
              phone: resolvedUser.phone || "",
              tier: resolvedUser.tier || "bronze",
              role: resolvedUser.role || "user",
            }
          : null,
      };
      // Copy the numbered product fields (already resolved to the real HHC
      // Product ID / HHC Variation ID above) so the archive keeps exactly
      // what was exported in this CSV.
      const products = [];
      for (let i = 1; i <= (o.productCount || 0); i++) {
        if (o[`product${i}`] !== undefined) doc[`product${i}`] = o[`product${i}`];
        if (o[`variation${i}`] !== undefined) doc[`variation${i}`] = o[`variation${i}`];
        if (o[`qty${i}`] !== undefined) doc[`qty${i}`] = o[`qty${i}`];
        if (o[`productSku${i}`] !== undefined) doc[`productSku${i}`] = o[`productSku${i}`];
        if (o[`variationName${i}`] !== undefined) doc[`variationName${i}`] = o[`variationName${i}`];
        if (o[`productName${i}`] !== undefined) doc[`productName${i}`] = o[`productName${i}`];
        if (o[`productPrice${i}`] !== undefined) doc[`productPrice${i}`] = o[`productPrice${i}`];

        // Structured product data for this line — real HHC ids everywhere
        const hhcPid = o[`product${i}`] ? String(o[`product${i}`]) : "";
        const sku = o[`productSku${i}`] || "";
        const label = o[`variationName${i}`] || "";
        const product =
          (hhcPid && productsByPid.get(hhcPid)) ||
          (sku && productsBySku.get(sku)) ||
          null;
        products.push({
          productId: hhcPid,
          variationId: o[`variation${i}`] ? String(o[`variation${i}`]) : "",
          variationName: label,
          sku,
          name: o[`productName${i}`] || product?.name || "",
          imageUrl: product?.imageUrl || "",
          price:
            o[`productPrice${i}`] !== undefined && o[`productPrice${i}`] !== null
              ? Number(o[`productPrice${i}`])
              : product?.retailPrice ?? null,
          quantity: o[`qty${i}`] ?? 0,
        });
      }
      doc.products = products;
      doc.productCount = o.productCount || 0;
      doc.productSearch = o.productSearch || [];
      return doc;
    });

    // ── Loyalty points ──────────────────────────────────────────────────────
    // Points are NOT awarded at checkout — they are granted here, when the
    // order is downloaded into the main-order CSV (i.e. it made it through
    // confirmation with stock available). Audited via OrderHistory.
    const LOYALTY_POINTS_PER_100 = 1; // 1 point per 100 PKR of sellPrice

    // Never award twice: history docs are keyed by the STABLE sourceOrderID
    // (the KO-rewrite changes orderID every download), and the unique index on
    // sourceOrderID makes any re-insert fail loudly as a backstop.
    const freshArchiveSourceIds = orders
      .map((o) => o._sourceOrderID || o.orderID)
      .filter(Boolean);
    const archivedBefore = freshArchiveSourceIds.length
      ? await OrderHistory.find({ sourceOrderID: { $in: freshArchiveSourceIds } })
          .select("sourceOrderID")
          .lean()
      : [];
    const archivedSet = new Set(archivedBefore.map((d) => d.sourceOrderID));
    const freshDocs = historyDocs.filter(
      (d) => !archivedSet.has(String(d.sourceOrderID || ""))
    );

    // insertMany with ordered:false so a single duplicate doesn't abort the batch
    if (freshDocs.length > 0) {
      await OrderHistory.insertMany(freshDocs, { ordered: false }).catch((err) => {
        // Ignore ONLY duplicate-key errors (11000 / 11001) — already archived.
        // Any other failure (validation, cast, connection) must NOT be silently
        // swallowed, otherwise archived orders silently disappear.
        const errs = err?.writeErrors ||
          (err?.code === 11000 || err?.code === 11001 ? [{ code: err.code }] : []);
        const onlyDuplicateKeys = errs.length > 0 && errs.every((e) => [11000, 11001].includes(e.code));
        if (!onlyDuplicateKeys) throw err;
      });
    }

    // Award loyalty points for the freshly archived orders only, tracking the
    // user account through the info captured in the order (user ref / email).
    const pointsByUser = {};
    for (const doc of freshDocs) {
      const userId = doc.user && doc.user.userId;
      if (!userId) continue;
      const sellPrice = Number(doc.sellPrice) || 0;
      const pts = sellPrice > 0 ? Math.max(1, Math.floor(sellPrice / 100)) : 0;
      if (pts > 0) pointsByUser[userId] = (pointsByUser[userId] || 0) + pts;
    }
    const userIds = Object.keys(pointsByUser);
    if (userIds.length > 0) {
      for (const uid of userIds) {
        await User.updateOne(
          { _id: uid },
          { $inc: { loyaltyPoints: pointsByUser[uid] } },
        ).catch((err) => console.error("[CSV] Loyalty points award failed:", err));
      }
      console.log(
        `[CSV] Awarded loyalty points to ${userIds.length} user(s) on order download: ` +
          Object.entries(pointsByUser)
            .map(([u, p]) => `${u}=+${p}`)
            .join(", ")
      );
    }

    // Step 5: Remove ONLY the records we captured by their exact _ids
    await MainOrderCSVData.deleteMany({ _id: { $in: capturedIds } });

    // Log the export activity
    await logActivity({
      user: req.user,
      action: ACTIONS.SETTINGS_UPDATED,
      description: `Exported ${orders.length} order(s) to HHC CSV`,
      req,
      metadata: { count: orders.length },
    });

    // Step 6: Send CSV as downloadable file
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulk-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error("downloadMainCSV error:", err);
    return res.status(500).json({ success: false, message: "Failed to generate CSV." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/export-csv/preorders
// Exports all PreOrder documents as an HHC-formatted CSV.
// Unlike the main CSV export this is non-destructive — records are NOT removed.
// ─────────────────────────────────────────────────────────────────────────────
const downloadPreOrderCSV = async (req, res) => {
  try {
    const preOrders = await PreOrder.find({})
      .populate("items.product", "sku name")
      .sort({ createdAt: -1 })
      .lean();

    const allOrders = preOrders;

    // Optional courierCity query override (same behaviour as the main CSV).
    const courierCityOverride = String(req.query.courierCity || "").trim();

    if (allOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No orders found to export.",
        count: 0,
      });
    }

    // Determine max items count to build dynamic product columns
    const maxItems = Math.max(
      MIN_PRODUCT_COLUMNS,
      allOrders.reduce(
        (max, o) => Math.max(max, (o.items || []).length),
        0,
      ),
    );

    const productColumns = [];
    for (let i = 1; i <= maxItems; i++) {
      productColumns.push(`product${i}`, `variation${i}`, `qty${i}`);
    }

    const allColumns = [
      ...BASE_CSV_COLUMNS,
      ...productColumns,
      "shipping",
      "allowToOpen",
      "email",
    ];

    const header = allColumns.join(",");

    const rows = allOrders.map((o) => {
      const productFields = {};
      (o.items || []).forEach((item, idx) => {
        const i = idx + 1;
        const sku = item.product?.sku || item.name || "";
        productFields[`product${i}`] = sku;
        productFields[`variation${i}`] = "";
        productFields[`qty${i}`] = item.quantity || 0;
      });

      const row = {
        orderID: o.order?.toString() || o._id.toString(),
        name: o.name || o.user?.name || "",
        address: o.address || "",
        shpType: "Regular",
        courierCompany: o.courierCompany || "",
        courierCity: o.courierCity || "",
        phoneNumber: o.phoneNumber || "",
        phoneNumber2: o.phoneNumber2 || "",
        sellPrice: o.sellPrice || o.totalAmount || 0,
        businessProfiles: o.businessProfiles ?? BUSINESS_PROFILE_DEFAULT,
        courierInstruction: o.courierInstruction || "",
        shipping: o.shipping || "cod",
        allowToOpen: o.allowToOpen || "",
        email: o.email || "",
        ...productFields,
      };

      return allColumns.map((col) => {
        if (col === "courierCity" && courierCityOverride) return escapeCSV(courierCityOverride);
        return escapeCSV(csvValue(row, col));
      }).join(",");
    });

    const csv = [header, ...rows].join("\r\n") + "\r\n";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="all-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error("downloadPreOrderCSV error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate CSV." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/export-csv/move-preorder/:id
// Moves a stuck PreOrder (confirmed but not in MainOrderCSVData) to the CSV queue.
// ─────────────────────────────────────────────────────────────────────────────
const movePreOrderToCSV = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid pre-order ID." });
    }

    const preOrder = await PreOrder.findById(id)
      .populate("items.product", "sku name")
      .lean();
    if (!preOrder) {
      return res.status(404).json({ success: false, message: "Pre-order not found." });
    }

    // Already moved — keyed by the order id the CSV queue uses (preOrder.order),
    // NOT the pre-order's own _id.
    const orderId = preOrder.order?.toString() || preOrder._id.toString();
    const existing = await MainOrderCSVData.findOne({ orderID: orderId }).lean();
    if (existing) {
      await PreOrder.deleteOne({ _id: preOrder._id });
      return res.status(200).json({ success: true, message: "Already in CSV queue. Cleaned up." });
    }

    const { productFields, productExtras, productSearch } =
      await buildHhcCSVProductFields(preOrder.items || []);

    const mainPayload = {
      orderID: orderId,
      name: preOrder.name || "",
      address: preOrder.address || "",
      shpType: preOrder.shpType || "Regular",
      courierCompany: preOrder.courierCompany || "",
      courierCity: preOrder.courierCity || "",
      phoneNumber: preOrder.phoneNumber || "",
      phoneNumber2: preOrder.phoneNumber2 || "",
      sellPrice: preOrder.sellPrice || preOrder.totalAmount || 0,
      businessProfiles: preOrder.businessProfiles ?? 1,
      courierInstruction: preOrder.courierInstruction || "",
      productCount: (preOrder.items || []).length,
      productSearch,
      ...productFields,
      ...productExtras,
      shipping: preOrder.shipping || "cod",
      allowToOpen: preOrder.allowToOpen || "",
      latitude: preOrder.latitude ?? null,
      longitude: preOrder.longitude ?? null,
      user: preOrder.user || null,
      userEmail: (preOrder.email || "").trim().toLowerCase() || "",
    };

    await MainOrderCSVData.findOneAndUpdate(
      { orderID: orderId },
      // hhcStatus must only be written on INSERT — re-running this admin move
      // on an already-assigned order previously reset it back to "pending".
      { $set: mainPayload, $setOnInsert: { exported: false, hhcStatus: "pending" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await PreOrder.deleteOne({ _id: preOrder._id });

    console.log(`[movePreOrderToCSV] Pre-order ${id} moved to MainOrderCSVData.`);
    return res.status(200).json({ success: true, message: "Moved to CSV queue." });
  } catch (err) {
    console.error("movePreOrderToCSV error:", err);
    return res.status(500).json({ success: false, message: "Failed to move pre-order." });
  }
};

module.exports = { downloadMainCSV, getCSVQueueCount, downloadPreOrderCSV, movePreOrderToCSV };
