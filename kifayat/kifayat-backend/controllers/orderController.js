const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderHistory = require("../models/OrderHistory");
const ShippingDetail = require("../models/ShippingDetail");
const MainOrderCSVData = require("../models/MainOrderCSVData");
const PreOrder = require("../models/PreOrder");
const CancelledOrders = require("../models/CancelledOrders");
const Product = require("../models/Product");
const { logActivity, ACTIONS } = require("../utils/activityLogger");
const { generateOTP, hashOTP, safeEqual, getOTPExpiry, isOTPExpired, storeOTP, findOTP, consumeOTP } = require("../utils/otp");
const { sendOTPEmail, sendOrderConfirmationEmail, sendOrderConfirmationLinkEmail, sendLateConfirmationEmail, sendAdminStockAlertEmail } = require("../utils/email");
const LateConfirmationOrder = require("../models/LateConfirmationOrder");
const { scheduleDeletion, cancelDeletion } = require("../utils/outOfStockManager");
const PurchasedVoucher = require("../models/PurchasedVoucher");
const { buildHhcCSVProductFields, matchVariation } = require("../utils/hhcExport");
const {
  convertReservationsToConsumed,
  releaseClaimedUses,
  restoreOrderVoucherUses,
  releaseReservedForProducts,
} = require("../utils/voucherLifecycle");
const Joi = require("joi");

// In-memory per-address throttle for order confirmation link emails. The
// confirmation email address is user-controlled and not OTP-gated at checkout,
// so an attacker could otherwise use the order endpoint as a mail bomb.
const orderConEmailCooldowns = new Map(); // email -> lastSentAt (ms)
const ORDER_CON_EMAIL_COOLDOWN_MS = 60 * 1000;

function checkOrderConEmailCooldown(email) {
  const lastSentAt = orderConEmailCooldowns.get(email);
  if (!lastSentAt) return 0;
  const elapsed = Date.now() - lastSentAt;
  if (elapsed >= ORDER_CON_EMAIL_COOLDOWN_MS) {
    orderConEmailCooldowns.delete(email);
    return 0;
  }
  return Math.ceil((ORDER_CON_EMAIL_COOLDOWN_MS - elapsed) / 1000);
}

function recordOrderConEmailSent(email) {
  orderConEmailCooldowns.set(email, Date.now());
}

function getRequestBaseUrl(req) {
  const origin = req.get("origin");
  if (origin) return origin;

  const forwardedProto = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();
  // Do not use req.host here: when the API is reached directly in local
  // development it is the backend port, not the frontend port.
  if (!forwardedHost) return "";

  const protocol = forwardedProto || "https";
  return `${protocol}://${forwardedHost}`;
}

/**
 * Normalized item shape for the late-confirmation archive — carries the
 * variation/product ids so the archived data stays fully reconstructable.
 */
function normalizeLateOrderItems(items = []) {
  return items.map((item) => ({
    product: item.product?._id || item.product,
    name: item.name || item.product?.name || "",
    price: item.price ?? item.product?.retailPrice ?? 0,
    quantity: item.quantity || 0,
    imageUrl: item.imageUrl || item.product?.imageUrl || "",
    variation: item.variation || "",
    variationId: item.variationId || "",
    productId: item.productId || "",
  }));
}

/**
 * Move a confirmed order into the two records used by the CSV workflow.
 *
 * Both customer email confirmation and admin finalization use this helper so
 * they cannot drift in which fields they save or which collections they touch.
 * The upsert/duplicate guards make a retry safe.
 */
async function createConfirmedOrderExports({
  user,
  order,
  items = [],
  csvItems = items,
  totalAmount = 0,
  shipping,
}) {
  const orderId = order?._id?.toString?.() || order?.toString?.() || String(order);
  const { productFields, productExtras, productSearch, resolvedItems } =
    await buildHhcCSVProductFields(csvItems);

  // Items carry the resolved HHC ids too, so the PreOrder record keeps the
  // complete variation information even before the Main Order CSV is built.
  const normalizedItems = items.map((item, idx) => {
    const r = resolvedItems[idx] || {};
    return {
      product: item.product?._id || item.product,
      name: r.name || item.name || item.product?.name || "",
      price: item.price ?? item.product?.retailPrice ?? 0,
      quantity: item.quantity || 0,
      imageUrl: item.imageUrl || item.product?.imageUrl || "",
      variation: r.variationName || item.variation || item.product?.variation || "",
      variationId: r.variationId || "",
      productId: r.hhcProductId || "",
    };
  });

  const preOrderPayload = {
    user,
    order: orderId,
    items: normalizedItems,
    totalAmount,
    status: "confirmed",
    name: shipping.name || "",
    address: shipping.address || "",
    shpType: shipping.shpType || "Regular",
    courierCompany: shipping.courierCompany || "",
    courierCity: shipping.courierCity || "",
    phoneNumber: shipping.phoneNumber || "",
    phoneNumber2: shipping.phoneNumber2 || "",
    sellPrice: shipping.sellPrice ?? totalAmount,
    businessProfiles: shipping.businessProfiles ?? 1,
    courierInstruction: shipping.courierInstruction || "",
    email: shipping.email || "",
    shipping: shipping.shipping || "cod",
    allowToOpen: shipping.allowToOpen || "",
    latitude: shipping.latitude ?? null,
    longitude: shipping.longitude ?? null,
    finalized: true,
  };

  let preOrder;
  try {
    preOrder = await PreOrder.findOneAndUpdate(
      { order: orderId },
      { $set: preOrderPayload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    // A concurrent retry inserted the same order between find and upsert.
    preOrder = await PreOrder.findOne({ order: orderId });
    if (!preOrder) throw err;
  }

  const mainPayload = {
    orderID: orderId,
    name: shipping.name || "",
    address: shipping.address || "",
    shpType: shipping.shpType || "Regular",
    courierCompany: shipping.courierCompany || "",
    courierCity: shipping.courierCity || "",
    phoneNumber: shipping.phoneNumber || "",
    phoneNumber2: shipping.phoneNumber2 || "",
    sellPrice: shipping.sellPrice ?? totalAmount,
    businessProfiles: shipping.businessProfiles ?? 1,
    courierInstruction: shipping.courierInstruction || "",
    productCount: csvItems.length,
    productSearch,
    ...productFields,
    ...productExtras,
    shipping: shipping.shipping || "cod",
    allowToOpen: shipping.allowToOpen || "",
    latitude: shipping.latitude ?? null,
    longitude: shipping.longitude ?? null,
    // Customer/user reference — kept on the main-order record so the CSV
    // archive can attach complete user + shipment data to the exported order.
    user: user || null,
    userEmail: (shipping.email || "").trim().toLowerCase() || "",
  };

  let mainOrderCSVData;
  try {
    mainOrderCSVData = await MainOrderCSVData.findOneAndUpdate(
      { orderID: orderId },
      { $set: mainPayload },
      { $setOnInsert: { exported: false }, upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    // A concurrent retry inserted the same order between find and upsert.
    mainOrderCSVData = await MainOrderCSVData.findOne({ orderID: orderId });
    if (!mainOrderCSVData) throw err;
  }

  return { preOrder, mainOrderCSVData };
}

// Shipping email OTPs are stored in MongoDB (see utils/otp.js storeOTP/consumeOTP).

// PreOrder confirmation timers — indexed by PreOrder _id string
const preOrderTimers = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/shipping-otp  — send OTP to confirmation email
// Body: { email, name }
// ─────────────────────────────────────────────────────────────────────────────
const sendShippingOTP = async (req, res) => {
  try {
    const { email, name } = req.body;
    const userId = req.user._id.toString();
    
    const schema = Joi.object({
      email: Joi.string().email().lowercase().required(),
      name: Joi.string().min(2).required(),
    });
    
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    
    const otp = generateOTP();
    const hashedOtp = hashOTP(otp);
    const expiry = getOTPExpiry();
    const storeKey = `${userId}-${email}`;
    
    await storeOTP(storeKey, "shipping-email", hashedOtp, expiry);
    
    try {
      await sendOTPEmail(email, name, otp);
    } catch (emailErr) {
      await consumeOTP(storeKey);
      console.error("Failed to send shipping OTP email:", emailErr);
      return res.status(500).json({ success: false, message: "Failed to send verification email." });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: "Verification code sent to your email!" 
    });
    
  } catch (err) {
    console.error("sendShippingOTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to send verification code." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/verify-shipping-otp — verify OTP for confirmation email
// Body: { email, otp }
// ─────────────────────────────────────────────────────────────────────────────
const verifyShippingOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userId = req.user._id.toString();
    
    const schema = Joi.object({
      email: Joi.string().email().lowercase().required(),
      otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    });
    
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    
    const storeKey = `${userId}-${email}`;
    const storedData = await findOTP(storeKey);
    
    if (!storedData) {
      return res.status(400).json({ success: false, message: "No verification code found. Please request a new one." });
    }
    
    if (isOTPExpired(storedData.expiry)) {
      await consumeOTP(storeKey);
      return res.status(400).json({ success: false, message: "Verification code expired. Please request a new one.", expired: true });
    }
    
    if (!safeEqual(hashOTP(otp), storedData.hashedOtp)) {
      return res.status(400).json({ success: false, message: "Invalid verification code." });
    }
    
    // OTP is valid — clear from store and save email to user's shipmentEmails
    await consumeOTP(storeKey);

    // Persist email to user profile so it appears in future checkout dropdowns
    try {
      const User = require("../models/User");
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { shipmentEmails: email },
      });
    } catch (saveErr) {
      console.error("Failed to save shipment email to user profile:", saveErr);
      // Non-fatal — order can still proceed
    }

    return res.status(200).json({ 
      success: true, 
      message: "Email verified successfully!" 
    });
    
  } catch (err) {
    console.error("verifyShippingOTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify code." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders  (authenticated user — place an order with shipping info)
// Body: { items, shippingDetails: { name, address, shpType, courierCompany, courierCity, phoneNumber, phoneNumber2, courierInstruction, shipping, allowToOpen } }
// ─────────────────────────────────────────────────────────────────────────────
// Restore stock for decrements that succeeded before a failure, clear the
// out-of-stock deletion timer, and log any rollback failures instead of
// silently swallowing them.
const rollbackStock = async (stockDecrements, outOfStockProductIds) => {
  for (const dec of stockDecrements) {
    const patch = { $inc: { stock: dec.qty, salesCount: -dec.qty } };
    if (outOfStockProductIds.has(String(dec.id))) {
      patch.$unset = { pendingDeleteAt: 1, stockOutAt: 1 };
    }
    try {
      await Product.findByIdAndUpdate(dec.id, patch);
    } catch (rollbackErr) {
      console.error(`Stock rollback failed for ${dec.id}:`, rollbackErr.message);
      try {
        await Product.findByIdAndUpdate(dec.id, { $inc: { stock: dec.qty, salesCount: -dec.qty } });
      } catch (retryErr) {
        console.error(`Stock rollback retry failed for ${dec.id}:`, retryErr.message);
      }
    }
    try {
      cancelDeletion(dec.id);
    } catch (timerErr) {
      console.error(`Failed to cancel deletion timer for ${dec.id}:`, timerErr.message);
    }
  }
};

const placeOrder = async (req, res) => {
  try {
    const { items, shippingDetails } = req.body;
    const voucherConversions = []; // { pvId, productId } — reserved uses claimed by this order
    let conversionCommitted = false; // true once reserved uses were converted to consumed

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    if (!shippingDetails) {
      return res.status(400).json({ success: false, message: "Shipping details are required." });
    }

    const required = ["name", "address", "shpType", "courierCompany", "courierCity", "phoneNumber", "shipping"];
    for (const field of required) {
      if (!shippingDetails[field] || !String(shippingDetails[field]).trim()) {
        return res.status(400).json({ success: false, message: `${field} is required.` });
      }
    }

    // Client idempotency key — a retry after a lost response must not create
    // a duplicate order. If an order for this key already exists, return it.
    const clientRequestId =
      typeof req.body.clientRequestId === "string" && req.body.clientRequestId.length <= 64
        ? req.body.clientRequestId
        : null;
    if (clientRequestId) {
      const existing = await Order.findOne({ clientRequestId, user: req.user._id }).lean();
      if (existing) {
        console.log(`[Order] Recovered existing order ${existing._id} for request ${clientRequestId}.`);
        return res.status(201).json({
          success: true,
          message: "Order placed successfully! Please check your email to confirm the order.",
          order: existing,
          confirmationNeeded: true,
        });
      }
    }

    // Validate products & build order items
    const orderItems = [];
    let totalAmount = 0;
    const stockDecrements = []; // track succeeded decrements for rollback
    const outOfStockProductIds = new Set(); // products that hit 0 stock this order

    // Stock validation + order creation share one scope so ANY failure
    // (missing stock, Order/ShippingDetail/PreOrder write error) triggers
    // the same stock rollback — no decremented stock can leak.
    try {
      // Load the user's reserved voucher uses for the ordered products.
      // Validation: the voucher must belong to the user, have a reserved use
      // on that product, and not be expired — checked again here at order time.
      const itemIds = items.map((i) => i.productId).filter(Boolean);
      const voucherMap = new Map();
      if (itemIds.length > 0) {
        const reservedDocs = await PurchasedVoucher.find({
          user: req.user._id,
          "applied_products.status": "reserved",
          "applied_products.product": { $in: itemIds },
        }).lean();

        for (const pv of reservedDocs) {
          for (const entry of pv.applied_products || []) {
            if (entry.status !== "reserved") continue;
            const key = String(entry.product);
            if (itemIds.some((id) => String(id) === key) && !voucherMap.has(key)) {
              voucherMap.set(key, {
                pvId: pv._id,
                pct: pv.discount_percent,
                expires_at: pv.expires_at,
              });
            }
          }
        }
      }

      for (const item of items) {
        // Atomically decrement stock — only succeeds if enough stock exists
        const product = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity, salesCount: item.quantity } },
          { new: true },
        );

        if (!product) {
          // Check if product exists at all vs insufficient stock
          const exists = await Product.findById(item.productId);
          if (!exists) {
            const err = new Error(`Product not found: ${item.productId}`);
            err.isStockError = true;
            throw err;
          }
          const err = new Error(
            `Not enough stock for ${exists.name}. Available: ${exists.stock}, requested: ${item.quantity}`,
          );
          err.isStockError = true;
          throw err;
        }

        // Register the decrement immediately — anything thrown below
        // (e.g. an expired voucher) must still roll this back.
        stockDecrements.push({ id: item.productId, qty: item.quantity });

        // User-level discount: only the admin-set custom percent applies.
        const userDiscPct = Math.min(
          100,
          Math.max(0, Number(req.user.customDiscountPercent) || 0),
        );

        // Voucher pricing — a reserved voucher on this product applies its
        // discount ON TOP of the user-level discount. Products without a
        // voucher still get the user-level discount.
        const voucherInfo = voucherMap.get(String(item.productId));
        if (voucherInfo && voucherInfo.expires_at && new Date(voucherInfo.expires_at) < new Date()) {
          const err = new Error(
            `The voucher applied to "${product.name}" has expired. Please remove it from the product and apply a valid voucher.`,
          );
          err.isStockError = true;
          throw err;
        }
        const unitPrice = voucherInfo
          ? Math.round(product.retailPrice * (1 - userDiscPct / 100) * (1 - voucherInfo.pct / 100))
          : Math.round(product.retailPrice * (1 - userDiscPct / 100));

        const variant = matchVariation(
          product,
          typeof item.variation === "string" ? item.variation : "",
        );

        orderItems.push({
          product: product._id,
          name: product.name,
          price: unitPrice,
          quantity: item.quantity,
          imageUrl: product.imageUrl || "",
          variation: typeof item.variation === "string" ? item.variation : "",
          // Resolve the exact HHC ids at checkout so the PreOrder and the Main
          // Order CSV data carry the variation id / product id immediately.
          variationId:
            variant && variant.id !== undefined && variant.id !== null
              ? String(variant.id)
              : "",
          productId: product.productId || "",
        });

        totalAmount += unitPrice * item.quantity;
        if (voucherInfo) {
          voucherConversions.push({ pvId: voucherInfo.pvId, productId: item.productId });
        }

        // Check if product went out of stock — schedule deletion
        if (product.stock === 0) {
          outOfStockProductIds.add(product._id.toString());
          product.pendingDeleteAt = new Date(Date.now() + 2 * 60 * 1000);
          product.stockOutAt = new Date();
          await product.save();
          const io = req.app?.get("io");
          scheduleDeletion(product._id, io);
          if (io) {
            io.emit("product_out_of_stock", {
              productId: product._id.toString(),
              name: product.name,
              category: product.category,
              stock: product.stock,
            });
          }
        }
      }

      // Create the order
      const order = await Order.create({
        user: req.user._id,
        items: orderItems,
        totalAmount,
        clientRequestId,
      });

      // Order placed — convert the reserved voucher uses into permanently
      // consumed uses tied to this order.
      await convertReservationsToConsumed(order._id, voucherConversions);
      conversionCommitted = true;

      // Save shipping details matching HHC CSV format
      const shippingDetail = await ShippingDetail.create({
        user: req.user._id,
        order: order._id,
        name: shippingDetails.name.trim(),
        address: shippingDetails.address.trim(),
        shpType: shippingDetails.shpType,
        courierCompany: shippingDetails.courierCompany.trim(),
        courierCity: shippingDetails.courierCity.trim(),
        phoneNumber: shippingDetails.phoneNumber.trim(),
        phoneNumber2: (shippingDetails.phoneNumber2 || "").trim(),
        sellPrice: totalAmount,
        businessProfiles: shippingDetails.businessProfiles || 1,
        courierInstruction: (shippingDetails.courierInstruction || "").trim(),
        email: (shippingDetails.orderConEmail || "").trim().toLowerCase(),
        shipping: shippingDetails.shipping,
        allowToOpen: shippingDetails.allowToOpen || "",
        latitude: shippingDetails.latitude ?? null,
        longitude: shippingDetails.longitude ?? null,
      });

      // Determine which email to use for order confirmation
      const orderConEmail = (shippingDetails.orderConEmail || req.user.email || "").trim().toLowerCase();

      // Create PreOrder entry immediately (order goes to PreOrder CSV)
      const confirmationToken = crypto.randomBytes(32).toString("hex");
      const confirmationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

      const preOrder = await PreOrder.create({
        user: req.user._id,
        order: order._id,
        items: orderItems,
        totalAmount,
        name: shippingDetails.name.trim(),
        address: shippingDetails.address.trim(),
        shpType: shippingDetails.shpType,
        courierCompany: shippingDetails.courierCompany.trim(),
        courierCity: shippingDetails.courierCity.trim(),
        phoneNumber: shippingDetails.phoneNumber.trim(),
        phoneNumber2: (shippingDetails.phoneNumber2 || "").trim(),
        sellPrice: totalAmount,
        businessProfiles: shippingDetails.businessProfiles || 1,
        courierInstruction: (shippingDetails.courierInstruction || "").trim(),
        email: orderConEmail,
        shipping: shippingDetails.shipping,
        allowToOpen: shippingDetails.allowToOpen || "",
        latitude: shippingDetails.latitude ?? null,
        longitude: shippingDetails.longitude ?? null,
        status: "pending",
        confirmationExpiresAt,
        confirmationToken,
      });

      // Schedule auto-cancellation after 1 day
      schedulePreOrderCancellation(preOrder._id.toString());

      // Send confirmation link email to the order confirmation email. The
      // address is user-controlled and not OTP-gated at checkout — throttle
      // per address so an attacker cannot use this endpoint as a mail bomb.
      let emailSent = false;
      const cooldownSeconds = checkOrderConEmailCooldown(orderConEmail);
      if (cooldownSeconds > 0) {
        console.log(
          `[Order] Skipped confirmation email to ${orderConEmail} — cooldown ${cooldownSeconds}s.`,
        );
      } else {
        try {
          await sendOrderConfirmationLinkEmail(
            orderConEmail,
            shippingDetails.name.trim(),
            order,
            confirmationToken,
            getRequestBaseUrl(req),
          );
          emailSent = true;
          recordOrderConEmailSent(orderConEmail);
        } catch (emailErr) {
          console.error("Failed to send confirmation link email:", emailErr);
        }
      }

      return res.status(201).json({
        success: true,
        message: emailSent
          ? "Order placed successfully! Please check your email to confirm the order."
          : "Order placed, but we could not send the confirmation email. Please contact support.",
        order,
        confirmationNeeded: true,
        confirmationExpiresAt,
        emailSent,
      });
    } catch (err) {
      // Roll back any stock decrements that succeeded
      await rollbackStock(stockDecrements, outOfStockProductIds);
      // Order was not successfully created — give the reserved voucher uses
      // back to the user automatically. If the conversion already committed,
      // the order exists and the uses stay consumed.
      if (!conversionCommitted) {
        try {
          await releaseClaimedUses(voucherConversions);
          // Items never reached by the pricing loop (e.g. a stock error on an
          // earlier item) still hold reservations — free those too.
          const itemIds = (items || []).map((i) => i.productId).filter(Boolean);
          await releaseReservedForProducts(req.user._id, itemIds);
        } catch (voucherErr) {
          console.error("Failed to release voucher uses after failed order:", voucherErr);
        }
      }
      const status = err.isStockError ? 400 : 500;
      return res.status(status).json({ success: false, message: err.message || "Failed to place order." });
    }
  } catch (err) {
    console.error("placeOrder error:", err);
    return res.status(500).json({ success: false, message: "Failed to place order." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/by-request/:clientRequestId  (authenticated user)
// Single source of truth for "was my order actually created?" — used by the
// frontend after a network error/timeout before deciding whether to release
// reserved voucher uses.
// ─────────────────────────────────────────────────────────────────────────────
const getOrderByClientRequestId = async (req, res) => {
  try {
    const { clientRequestId } = req.params;
    if (!clientRequestId) {
      return res.status(400).json({ success: false, message: "clientRequestId is required." });
    }
    const order = await Order.findOne({ clientRequestId, user: req.user._id })
      .select("_id totalAmount createdAt")
      .lean();
    res.json({ success: true, order: order || null });
  } catch (err) {
    console.error("Get order by request error:", err);
    res.status(500).json({ success: false, message: "Failed to check order status." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/my  (authenticated user — their own orders)
// ─────────────────────────────────────────────────────────────────────────────
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.product", "name imageUrl retailPrice lowPrice");

    const shippingDetails = await ShippingDetail.find({ user: req.user._id });
    const shippingMap = {};
    shippingDetails.forEach((s) => {
      shippingMap[s.order.toString()] = s;
    });

    return res.status(200).json({ success: true, orders, shippingMap });
  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders  (admin — all orders with full shipping details)
// ─────────────────────────────────────────────────────────────────────────────
const getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [orders, total, allShipping] = await Promise.all([
      Order.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name email")
        .populate("items.product", "name imageUrl retailPrice lowPrice"),
      Order.countDocuments({}),
      ShippingDetail.find({}).lean(),
    ]);

    const shippingMap = {};
    allShipping.forEach((s) => {
      shippingMap[s.order.toString()] = s;
    });

    return res.status(200).json({
      success: true,
      orders,
      shippingMap,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status  (admin — update order status)
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const oldStatus = order.status;
    order.status = status;
    await order.save();

    // Admin cancelled the order — restore any consumed voucher uses
    if (status === "cancelled" && oldStatus !== "cancelled") {
      await restoreOrderVoucherUses(order._id);

      // A still-pending PreOrder for this order must be cancelled too —
      // otherwise the 24h auto-cancel timer would later fire on an order the
      // admin already cancelled, and the Pre Order CSV would keep showing it.
      const pendingPre = await PreOrder.findOne({
        order: order._id,
        status: "pending",
      });
      if (pendingPre) {
        await PreOrder.updateOne(
          { _id: pendingPre._id },
          { $set: { status: "cancelled", confirmedAt: null, cancelReason: "Cancelled by admin." } },
        );
        cancelPreOrderCancellation(pendingPre._id.toString());
      }
    }

    // Log admin activity for status change
    await logActivity({
      user: req.user,
      action: ACTIONS.ORDER_STATUS_CHANGED,
      description: `Changed order #${order._id.toString().slice(-8).toUpperCase()} status from "${oldStatus}" to "${status}"`,
      req,
      metadata: { orderId: order._id, oldStatus, newStatus: status },
    });

    return res.status(200).json({ success: true, message: "Order status updated.", order });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/finalize/:id  (moves an admin-finalized order to the CSV workflow)
// ─────────────────────────────────────────────────────────────────────────────
const finalizeOrder = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const order = await Order.findById(req.params.id).populate("items.product", "name sku");
    if (!order) {
      const [preOrder, mainOrderCSVData] = await Promise.all([
        PreOrder.exists({ order: req.params.id, finalized: true }),
        MainOrderCSVData.exists({ orderID: req.params.id }),
      ]);
      const alreadyFinalized = preOrder || mainOrderCSVData;
      if (alreadyFinalized) {
        return res.status(200).json({ success: true, message: "Order already finalized." });
      }
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const sd = await ShippingDetail.findOne({ order: order._id });
    if (!sd) {
      return res.status(400).json({ success: false, message: "Shipping details not found for this order." });
    }

    const { preOrder, mainOrderCSVData: doc } = await createConfirmedOrderExports({
      user: order.user,
      order: order._id,
      items: order.items || [],
      totalAmount: order.totalAmount || 0,
      shipping: sd,
    });

    // The order is now in Main Order CSV — remove the finalized PreOrder
    // record so it does not linger in the Pre Order CSV / queue.
    await PreOrder.deleteOne({ _id: preOrder._id }).catch(() => {});

    // Remove the original pending records after both shared export records exist.
    await Order.deleteOne({ _id: order._id });
    await ShippingDetail.deleteOne({ _id: sd._id });

    return res.status(201).json({
      success: true,
      message: "Order finalized and stored in Main Order CSV Data.",
      doc,
    });
  } catch (err) {
    console.error("finalizeOrder error:", err);
    return res.status(500).json({ success: false, message: "Failed to finalize order." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PreOrder confirmation processing
// ─────────────────────────────────────────────────────────────────────────────

function schedulePreOrderCancellation(preOrderId) {
  cancelPreOrderCancellation(preOrderId);
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const timeout = setTimeout(async () => {
    try {
      await processPreOrderCancellation(preOrderId);
    } catch (err) {
      console.error("processPreOrderCancellation error:", err);
    } finally {
      preOrderTimers.delete(preOrderId);
    }
  }, ONE_DAY);
  preOrderTimers.set(preOrderId, timeout);
}

function cancelPreOrderCancellation(preOrderId) {
  const timeout = preOrderTimers.get(preOrderId);
  if (timeout) {
    clearTimeout(timeout);
    preOrderTimers.delete(preOrderId);
  }
}

async function processPreOrderCancellation(preOrderId) {
  // Claim the pre-order atomically before doing any work: the confirm link
  // claims the same document via { status: { $ne: "confirmed" } } (success)
  // / { status: { $ne: "cancelled" } } (stock failure) — whichever claim wins,
  // the other request simply bails out, so a confirm that lands at the exact
  // same instant as the 24h timer can never double-process the order.
  const preOrder = await PreOrder.findOneAndUpdate(
    { _id: preOrderId, status: "pending" },
    { $set: { status: "cancelled", confirmedAt: null, cancelReason: "Order was automatically cancelled because the customer did not confirm the order within 24 hours." } },
  );
  if (!preOrder) return; // already confirmed / cancelled / processed

  try {
    // Not confirmed - move to CancelledOrders, restore stock
    // Restore stock for each item
    for (const item of preOrder.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, salesCount: -item.quantity },
      }).catch(() => {});
    }

    await CancelledOrders.create({
      user: preOrder.user,
      order: preOrder.order,
      originalPreOrderId: preOrder._id,
      confirmationToken: preOrder.confirmationToken || "",
      items: preOrder.items,
      totalAmount: preOrder.totalAmount,
      name: preOrder.name,
      address: preOrder.address,
      shpType: preOrder.shpType,
      courierCompany: preOrder.courierCompany,
      courierCity: preOrder.courierCity,
      phoneNumber: preOrder.phoneNumber,
      phoneNumber2: preOrder.phoneNumber2,
      sellPrice: preOrder.sellPrice,
      businessProfiles: preOrder.businessProfiles,
      courierInstruction: preOrder.courierInstruction,
      email: preOrder.email,
      shipping: preOrder.shipping,
      allowToOpen: preOrder.allowToOpen,
      confirmed: false,
      cancelledAt: new Date(),
      cancelReason: "Order was automatically cancelled because the customer did not confirm the order within 24 hours.",
    });

    // Restore any voucher uses consumed by this order
    await restoreOrderVoucherUses(preOrder.order);

    // Remove the original Order + ShippingDetail from daily collections
    await Order.deleteOne({ _id: preOrder.order });
    await ShippingDetail.deleteOne({ order: preOrder.order });

    await PreOrder.deleteOne({ _id: preOrder._id });
    console.log(`[PreOrder] Order ${preOrder.order} not confirmed — moved to CancelledOrders, stock restored.`);
  } catch (err) {
    console.error(`[PreOrder] Error processing ${preOrderId}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/confirm/:token  — confirm an order via emailed link
// Moves order from PreOrder to Main Order CSV.
//
// Stock gate: the order only moves to main orders when every item's required
// quantity is actually available on the website. Otherwise it becomes a
// late-confirmation order (stock restored, customer + admin notified) and is
// managed manually. Both this route AND /api/workflow/confirm-preorder/:token
// resolve to this one canonical handler.
// ─────────────────────────────────────────────────────────────────────────────
const confirmOrder = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) {
      return res.status(400).json({ success: false, message: "Invalid confirmation token." });
    }

    const preOrder = await PreOrder.findOne({ confirmationToken: token });
    if (!preOrder) {
      // The confirmation link may have been used already. The successful
      // confirmation flow deletes the PreOrder, so a repeated click can no
      // longer find it here — check the CSV/bulk-order records instead and
      // report a friendly "already confirmed" instead of a scary "invalid link".
      const alreadyMoved = await MainOrderCSVData.findOne({ confirmationToken: token });
      if (alreadyMoved) {
        return res.status(200).json({ success: true, message: "Order already confirmed." });
      }
      // The order may have been auto-cancelled (24h window passed) or
      // cancelled by the customer — tell the user what happened instead of
      // a generic "invalid link".
      const cancelled = await CancelledOrders.findOne({ confirmationToken: token });
      if (cancelled) {
        return res.status(400).json({
          success: false,
          message: "This order was not confirmed in time and has been cancelled.",
          expired: true,
        });
      }
      return res.status(404).json({ success: false, message: "Confirmation link is invalid or expired." });
    }

    if (preOrder.status === "confirmed") {
      return res.status(200).json({ success: true, message: "Order already confirmed." });
    }

    if (new Date() > new Date(preOrder.confirmationExpiresAt)) {
      return res.status(400).json({ success: false, message: "Confirmation period has expired. The order has been cancelled.", expired: true });
    }

    // ── Stock gate: every item must be available on the website ─────────────
    const stockChecks = [];
    for (const item of preOrder.items) {
      const productId = item.product?._id || item.product;
      if (!productId) {
        stockChecks.push({ ok: false, name: item.name || "Unknown", reason: "No product reference" });
        continue;
      }
      const product = await Product.findById(productId).lean();
      if (!product) {
        stockChecks.push({ ok: false, name: item.name || "Unknown", reason: "Product not found" });
        continue;
      }
      const required = item.quantity || 1;
      if (product.stock < required) {
        stockChecks.push({ ok: false, name: product.name, available: product.stock, required });
      } else {
        stockChecks.push({ ok: true });
      }
    }

    const allStockOk = stockChecks.every((c) => c.ok);

    if (!allStockOk) {
      const failedItems = stockChecks.filter((c) => !c.ok);

      // Claim the pre-order atomically so the 24h timer / double click can't
      // double-process the same failed confirmation.
      const claimed = await PreOrder.findOneAndUpdate(
        { _id: preOrder._id, status: { $ne: "cancelled" } },
        { $set: { status: "cancelled", confirmedAt: null, cancelReason: "Late confirmation — product not available on website" } },
      );
      if (!claimed) {
        return res.status(200).json({ success: false, message: "This order was already processed." });
      }
      cancelPreOrderCancellation(preOrder._id.toString());

      // Archive to late-confirmation orders for manual handling
      await LateConfirmationOrder.create({
        user: preOrder.user,
        order: preOrder.order,
        originalPreOrderId: preOrder._id,
        items: normalizeLateOrderItems(preOrder.items),
        totalAmount: preOrder.totalAmount,
        name: preOrder.name,
        address: preOrder.address,
        shpType: preOrder.shpType,
        courierCompany: preOrder.courierCompany,
        courierCity: preOrder.courierCity,
        phoneNumber: preOrder.phoneNumber,
        phoneNumber2: preOrder.phoneNumber2,
        sellPrice: preOrder.sellPrice,
        businessProfiles: preOrder.businessProfiles,
        courierInstruction: preOrder.courierInstruction,
        email: preOrder.email,
        shipping: preOrder.shipping,
        allowToOpen: preOrder.allowToOpen,
        notifiedAt: new Date(),
      });

      // Restore stock
      for (const item of preOrder.items) {
        await Product.findByIdAndUpdate(item.product?._id || item.product, {
          $inc: { stock: item.quantity, salesCount: -item.quantity },
        }).catch(() => {});
      }

      // Notify the customer
      try {
        await sendLateConfirmationEmail(preOrder.email, preOrder.name, preOrder);
      } catch (emailErr) {
        console.error("[Confirm] Failed to send late confirmation email:", emailErr);
      }

      // Notify the admin — the email names the user: late confirmation,
      // product not available, everything will be handled manually.
      try {
        await sendAdminStockAlertEmail({
          orderId: preOrder.order,
          customerName: preOrder.name,
          customerEmail: preOrder.email,
          orderType: "late confirmation (pre-order)",
        });
      } catch (emailErr) {
        console.error("[Confirm] Failed to send admin stock alert email:", emailErr);
      }

      // Order never fulfilled — restore any voucher uses consumed by it
      await restoreOrderVoucherUses(preOrder.order);

      // Cleanup daily collections
      await Order.deleteOne({ _id: preOrder.order }).catch(() => {});
      await ShippingDetail.deleteOne({ order: preOrder.order }).catch(() => {});
      await PreOrder.deleteOne({ _id: preOrder._id }).catch(() => {});

      console.log(`[PreOrder] Order ${preOrder.order} — late confirmation, product not available. Moved to late_confirmation_orders for manual handling.`);

      return res.status(200).json({
        success: false,
        message: "Stock is currently unavailable. A notification has been sent to your email.",
        stockIssues: failedItems,
        lateConfirmation: true,
      });
    }

    // ── Stock OK — move to Main Order CSV ───────────────
    // Claim the pre-order atomically: only one request may confirm it; the
    // 24h auto-cancel timer also claims via the same status transition.
    const claimed = await PreOrder.findOneAndUpdate(
      { _id: preOrder._id, status: { $ne: "confirmed" } },
      { $set: { status: "confirmed", confirmedAt: new Date() } },
    );
    if (!claimed) {
      return res.status(200).json({ success: true, message: "Order already confirmed." });
    }

    // Cancel the scheduled timer
    cancelPreOrderCancellation(preOrder._id.toString());

    try {
      // Move to MainOrder CSV
      const populatedPreOrder = await PreOrder.findOne({ _id: preOrder._id })
        .populate("items.product", "sku name")
        .lean();

      const items = populatedPreOrder?.items || preOrder.items || [];
      const { preOrder: finalizedPreOrder } = await createConfirmedOrderExports({
        user: preOrder.user,
        order: preOrder.order,
        items: preOrder.items || [],
        csvItems: items,
        totalAmount: preOrder.totalAmount || 0,
        shipping: preOrder,
      });

      // The order is now in Main Order CSV — remove it from Pre Orders so it
      // does not linger in the Pre Order CSV / queue. Prefer the record that
      // was actually finalized (keeps the token for duplicate-link handling).
      const pid = finalizedPreOrder && finalizedPreOrder._id
        ? finalizedPreOrder._id
        : preOrder._id;
      await PreOrder.deleteOne({ _id: pid });

      // Keep the token on the moved record so a repeated click on the emailed
      // link resolves to "already confirmed" instead of "invalid link".
      await MainOrderCSVData.updateOne(
        { orderID: preOrder.order.toString() },
        { $set: { confirmationToken: token } },
      );

      // Remove the original Order + ShippingDetail from daily collections
      await Order.deleteOne({ _id: preOrder.order });
      await ShippingDetail.deleteOne({ order: preOrder.order });
    } catch (err) {
      // Moving to Main Order CSV failed — revert the order to "pending" so it
      // is never left half-confirmed / stuck outside both CSVs. The scheduled
      // auto-cancellation timer resumes and the admin can retry later.
      console.error(`[PreOrder] Confirm move failed for ${preOrder._id}:`, err);
      await PreOrder.updateOne(
        { _id: preOrder._id },
        { $set: { status: "pending", confirmedAt: null } },
      ).catch(() => {});
      schedulePreOrderCancellation(preOrder._id.toString());
      throw err;
    }

    console.log(`[PreOrder] Order ${preOrder.order} confirmed — moved to MainOrderCSVData.`);

    // Send order receipt email
    try {
      const receiptOrder = await Order.findById(preOrder.order).lean();
      if (receiptOrder) {
        await sendOrderConfirmationEmail(
          preOrder.email || "",
          preOrder.name || "Customer",
          receiptOrder,
          { name: preOrder.name, phoneNumber: preOrder.phoneNumber, phoneNumber2: preOrder.phoneNumber2, address: preOrder.address, courierCity: preOrder.courierCity, shpType: preOrder.shpType, courierCompany: preOrder.courierCompany, shipping: preOrder.shipping },
        );
      }
    } catch (receiptErr) {
      console.error("Failed to send confirmation receipt email:", receiptErr);
    }

    return res.status(200).json({
      success: true,
      message: "Order confirmed successfully! Thank you.",
      orderId: preOrder.order.toString(),
    });
  } catch (err) {
    console.error("confirmOrder error:", err);
    return res.status(500).json({ success: false, message: "Failed to confirm order." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/cancel/:token  — cancel an order via emailed link
// Moves order from PreOrder to CancelledOrders
// ─────────────────────────────────────────────────────────────────────────────
const cancelOrder = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) {
      return res.status(400).json({ success: false, message: "Invalid cancellation token." });
    }

    const preOrder = await PreOrder.findOne({ confirmationToken: token });
    if (!preOrder) {
      return res.status(404).json({ success: false, message: "Cancellation link is invalid or expired." });
    }

    if (preOrder.status === "confirmed") {
      return res.status(400).json({ success: false, message: "Order already confirmed and cannot be cancelled." });
    }

    // Cancel the scheduled timer
    cancelPreOrderCancellation(preOrder._id.toString());

    // Restore stock for each item
    for (const item of preOrder.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, salesCount: -item.quantity },
      }).catch(() => {});
    }

    // Move to CancelledOrders
    await CancelledOrders.create({
      user: preOrder.user,
      order: preOrder.order,
      originalPreOrderId: preOrder._id,
      confirmationToken: preOrder.confirmationToken || "",
      items: preOrder.items,
      totalAmount: preOrder.totalAmount,
      name: preOrder.name,
      address: preOrder.address,
      shpType: preOrder.shpType,
      courierCompany: preOrder.courierCompany,
      courierCity: preOrder.courierCity,
      phoneNumber: preOrder.phoneNumber,
      phoneNumber2: preOrder.phoneNumber2,
      sellPrice: preOrder.sellPrice,
      businessProfiles: preOrder.businessProfiles,
      courierInstruction: preOrder.courierInstruction,
      email: preOrder.email,
      shipping: preOrder.shipping,
      allowToOpen: preOrder.allowToOpen,
      confirmed: false,
      cancelledAt: new Date(),
      cancelReason: "Order cancelled by user.",
    });

    // Restore any voucher uses consumed by this order
    await restoreOrderVoucherUses(preOrder.order);

    // Remove the original Order + ShippingDetail from daily collections
    await Order.deleteOne({ _id: preOrder.order });
    await ShippingDetail.deleteOne({ order: preOrder.order });

    // Remove from PreOrder
    await PreOrder.deleteOne({ _id: preOrder._id });

    console.log(`[PreOrder] Order ${preOrder.order} cancelled — moved to CancelledOrders, stock restored.`);

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully. Stock has been restored.",
    });
  } catch (err) {
    console.error("cancelOrder error:", err);
    return res.status(500).json({ success: false, message: "Failed to cancel order." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Restore pending PreOrder timers on server restart
// ─────────────────────────────────────────────────────────────────────────────
async function restorePendingPreOrders() {
  try {
    const now = new Date();
    const expired = await PreOrder.find({ status: "pending", confirmationExpiresAt: { $lte: now } });
    for (const preOrder of expired) {
      await processPreOrderCancellation(preOrder._id.toString());
    }

    const pending = await PreOrder.find({ status: "pending", confirmationExpiresAt: { $gt: now } });
    for (const preOrder of pending) {
      schedulePreOrderCancellation(preOrder._id.toString());
    }

    // Self-healing: any PreOrder that is confirmed/finalized but still sitting
    // in Pre Orders (e.g. a crashed move, or an old flow that kept the record)
    // belongs in Main Order CSV. Move it there now so the Pre Order CSV never
    // holds orders that are already confirmed.
    const stuck = await PreOrder.find({
      status: "confirmed",
    });
    let moved = 0;
    for (const preOrder of stuck) {
      try {
        const orderId = preOrder.order?.toString?.() || "";
        if (!orderId) continue;

        const alreadyMoved = await MainOrderCSVData.exists({ orderID: orderId });
        if (alreadyMoved) {
          // The confirm flow deletes the daily Order + ShippingDetail when it
          // moves an order to the CSV — a leftover here means a crashed move.
          // Clean the ghosts so daily collections never hold dead records.
          await PreOrder.deleteOne({ _id: preOrder._id }).catch(() => {});
          await Order.deleteOne({ _id: orderId }).catch(() => {});
          await ShippingDetail.deleteOne({ order: orderId }).catch(() => {});
          moved += 1;
          continue;
        }

        const populated = await PreOrder.findById(preOrder._id)
          .populate("items.product", "sku name")
          .lean();
        await createConfirmedOrderExports({
          user: preOrder.user,
          order: preOrder.order,
          items: preOrder.items || [],
          csvItems: populated?.items || [],
          totalAmount: preOrder.totalAmount || 0,
          shipping: preOrder,
        });
        await PreOrder.deleteOne({ _id: preOrder._id }).catch(() => {});
        // The move is complete — the daily records are now redundant
        // (mirrors what the confirm/finalize flow does after the CSV move).
        await Order.deleteOne({ _id: orderId }).catch(() => {});
        await ShippingDetail.deleteOne({ order: orderId }).catch(() => {});
        moved += 1;
        console.log(`[PreOrder] Swept stuck confirmed pre-order ${preOrder._id} into Main Order CSV.`);
      } catch (sweepErr) {
        console.error(`[PreOrder] Sweep failed for ${preOrder._id}:`, sweepErr.message);
      }
    }

    const total = expired.length + pending.length;
    if (total > 0) {
      console.log(`[PreOrder] Restored ${total} pending pre-orders (${expired.length} expired, ${pending.length} pending)`);
    }
    if (moved > 0) {
      console.log(`[PreOrder] Moved ${moved} confirmed pre-order(s) to Main Order CSV.`);
    }
  } catch (err) {
    console.error("[PreOrder] Restore error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/preorders  (admin) — list all confirmed PreOrders
// ─────────────────────────────────────────────────────────────────────────────
const getAllPreOrders = async (req, res) => {
  try {
    const PreOrder = require("../models/PreOrder");
    const preOrders = await PreOrder.find({})
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .populate("items.product", "name imageUrl sku")
      .lean();

    return res.status(200).json({ success: true, preOrders });
  } catch (err) {
    console.error("getAllPreOrders error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch pre-orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/count  (public — storefront trust proof)
// ─────────────────────────────────────────────────────────────────────────────
const getPublicOrderCount = async (req, res) => {
  try {
    const [orders, purchased] = await Promise.all([
      Order.countDocuments(),
      require("../models/MainOrderCSVData").countDocuments({}).catch(() => 0),
    ]);
    return res.status(200).json({ success: true, total: orders + (purchased || 0) });
  } catch (err) {
    return res.status(200).json({ success: true, total: 0 });
  }
};

const resendOrderConfirmation = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) return res.status(400).json({ success: false, message: "Order number is required." });

    const preOrder = await require("../models/PreOrder").findOne({
      user: req.user._id,
      order: orderNumber,
      status: "pending",
    }).populate("order");

    if (!preOrder) {
      return res.status(404).json({ success: false, message: "No pending order found with that number." });
    }

    const email = preOrder.email || req.user.email;
    if (!email) return res.status(400).json({ success: false, message: "No email on file." });

    const cooldownSeconds = checkOrderConEmailCooldown(email);
    if (cooldownSeconds > 0) {
      return res.status(429).json({ success: false, message: `Please wait ${cooldownSeconds}s before resending.` });
    }

    const confirmationToken = preOrder.confirmationToken;
    if (!confirmationToken) return res.status(400).json({ success: false, message: "No confirmation token found." });

    await sendOrderConfirmationLinkEmail(
      email,
      preOrder.name || req.user.name || "Customer",
      preOrder.order,
      confirmationToken,
      getRequestBaseUrl(req),
    );
    recordOrderConEmailSent(email);

    return res.status(200).json({ success: true, message: "Confirmation email resent!" });
  } catch (err) {
    console.error("Resend confirmation error:", err);
    return res.status(500).json({ success: false, message: "Failed to resend." });
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getAllOrders,
  getAllPreOrders,
  updateOrderStatus,
  sendShippingOTP,
  verifyShippingOTP,
  finalizeOrder,
  confirmOrder,
  cancelOrder,
  getOrderByClientRequestId,
  processPreOrderCancellation,
  restorePendingPreOrders,
  getPublicOrderCount,
  resendOrderConfirmation,
};
