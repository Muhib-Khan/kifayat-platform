const { Resend } = require("resend");
const nodemailer = require("nodemailer");
const { normalizeAppUrl } = require("./appUrl");

// ---------------------------------------------------------------------------
// Email providers
//
// Prefer the domain-authenticated sender when a verified RESEND_FROM_EMAIL is
// configured; fall back to Gmail SMTP when that sender is missing or generic.
// This keeps OTP delivery working while making production mail look like a
// legitimate branded transactional sender.
// ---------------------------------------------------------------------------
const rawEmailUser = (process.env.EMAIL_USER || "").trim();
const rawEmailPass = process.env.EMAIL_PASS || "";
const normalizedEmailPass = rawEmailPass.replace(/\s+/g, "");
const gmailPassWasNormalized = Boolean(
  rawEmailPass && rawEmailPass !== normalizedEmailPass,
);

const hasGmail = Boolean(rawEmailUser && normalizedEmailPass);
const hasResend = Boolean(process.env.RESEND_API_KEY);

const gmailTransporter = hasGmail
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: rawEmailUser,
        pass: normalizedEmailPass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    })
  : null;

const resend = hasResend ? new Resend(process.env.RESEND_API_KEY) : null;
let resendTemporarilyDisabled = false;

const GMAIL_FROM = rawEmailUser
  ? `"Kifayat" <${rawEmailUser}>`
  : `"Kifayat" <no-reply@kifayat.co>`;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || `"Kifayat" <onboarding@resend.dev>`;
const RESEND_FROM_IS_GENERIC =
  !process.env.RESEND_FROM_EMAIL || /@resend\.dev>?$/i.test(process.env.RESEND_FROM_EMAIL);

function extractEmailAddress(sender) {
  const match = String(sender || "").match(/<([^>]+)>/);
  return match ? match[1].trim() : String(sender || "").trim();
}

function extractDisplayName(sender) {
  const match = String(sender || "").match(/^(.*)<[^>]+>$/);
  return match ? match[1].trim() : "";
}

function resolveFromAddress(requestedFrom, provider) {
  if (provider === "gmail") {
    const displayName = extractDisplayName(requestedFrom);
    return displayName ? `${displayName} <${rawEmailUser}>` : GMAIL_FROM;
  }
  return requestedFrom || RESEND_FROM;
}

function resolveReplyToAddress(sender) {
  return process.env.REPLY_TO_EMAIL || process.env.SUPPORT_EMAIL || extractEmailAddress(sender);
}

function getPreferredProvider() {
  if (hasResend) return "resend";
  if (hasGmail) return "gmail";
  return null;
}

function getProviderOrder() {
  const preferred = getPreferredProvider();
  if (preferred === "resend") {
    return hasGmail ? ["resend", "gmail"] : ["resend"];
  }
  if (preferred === "gmail") {
    return hasResend ? ["gmail", "resend"] : ["gmail"];
  }
  return [];
}

function isResendAuthFailure(error) {
  const statusCode = error && (error.statusCode || error.status);
  const message = String((error && error.message) || "").toLowerCase();
  return statusCode === 401 || statusCode === 403 || message.includes("invalid api key");
}

function getTransactionalHeaders() {
  return {
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All",
    "X-Priority": "3",
    "X-Mailer": "Kifayat Transactional Mailer",
    "Precedence": "bulk",
  };
}

function getEmailProviderStatus() {
  const preferredProvider = getPreferredProvider();
  return {
    hasGmail,
    hasResend,
    gmailPassWasNormalized,
    gmailFrom: GMAIL_FROM,
    resendFrom: RESEND_FROM,
    resendFromIsGeneric: RESEND_FROM_IS_GENERIC,
    preferredProvider,
    replyTo: resolveReplyToAddress(preferredProvider === "resend" ? RESEND_FROM : GMAIL_FROM),
  };
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function getConfirmationBaseUrl(requestBaseUrl) {
  // PUBLIC_APP_URL is the portable deployment setting. FRONTEND_URL remains
  // supported for existing installations. normalizeAppUrl maps any stale apex
  // (https://kifayat.co) value to the canonical www host.
  const configuredUrl = normalizeAppUrl(
    process.env.PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      process.env.FRONTEND_URL,
  );
  const requestUrl = normalizeBaseUrl(requestBaseUrl);

  // Never send a loopback URL to a remote customer when the request arrived
  // through a public frontend host.
  const configuredIsLoopback = configuredUrl
    ? /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(new URL(configuredUrl).hostname)
    : false;

  if (configuredUrl && !configuredIsLoopback) return configuredUrl;
  if (requestUrl) return requestUrl;
  return configuredUrl || "http://localhost:5000";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Sanitize user input to prevent XSS and spam triggers
function sanitizeText(text) {
  if (!text) return "";
  return String(text)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .trim();
}

// Rough HTML-to-text conversion — gives every email a plain-text alternative,
// which improves deliverability (spam filters penalise HTML-only mail).
function htmlToText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendMail({ from, to, subject, html, text }) {
  const toList = Array.isArray(to) ? to : [to];
  const errors = [];
  const providerOrder = getProviderOrder();

  if (!providerOrder.length) {
    throw new Error("No email provider is configured.");
  }

  const headers = getTransactionalHeaders(subject);

  for (const provider of providerOrder) {
    if (provider === "gmail" && gmailTransporter) {
      try {
        const gmailFrom = resolveFromAddress(from, "gmail");
        const replyTo = resolveReplyToAddress(gmailFrom);
        await gmailTransporter.sendMail({
          from: gmailFrom,
          to: toList,
          subject,
          html,
          text: text || htmlToText(html),
          replyTo,
          headers,
        });
        console.log(`[email] Sent via Gmail as ${gmailFrom} to ${toList.join(", ")}`);
        return;
      } catch (error) {
        errors.push(`Gmail: ${error.message}`);
        console.error("[email] Gmail delivery failed:", error.message);
      }
    }

    if (provider === "resend" && resend && !resendTemporarilyDisabled) {
      try {
        const resendFrom = resolveFromAddress(from, "resend");
        const replyTo = resolveReplyToAddress(resendFrom);
        const { error } = await resend.emails.send({
          from: resendFrom,
          to: toList,
          subject,
          html,
          text: text || htmlToText(html),
          replyTo,
          headers,
        });
        if (!error) {
          console.log(`[email] Sent via Resend as ${resendFrom} to ${toList.join(", ")}`);
          return;
        }
        errors.push(`Resend: ${error.message || JSON.stringify(error)}`);
        if (isResendAuthFailure(error)) {
          resendTemporarilyDisabled = true;
          console.warn("[email] Resend auth failed — using Gmail fallback for the rest of this process.");
        }
      } catch (error) {
        errors.push(`Resend: ${error.message}`);
        if (isResendAuthFailure(error)) {
          resendTemporarilyDisabled = true;
          console.warn("[email] Resend auth failed — using Gmail fallback for the rest of this process.");
        }
      }
    }
  }

  throw new Error(errors.join(" | ") || "No email provider is configured.");
}

// ---------------------------------------------------------------------------
// OTP verification
// ---------------------------------------------------------------------------

const sendOTPEmail = async (to, name, otp) => {
  await sendMail({
    to,
    subject: "Kifayat verification code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#111827;margin-top:0;">Verify your Kifayat account</h2>
        <p style="color:#374151;">Hi <strong>${sanitizeText(name)}</strong>,</p>
        <p style="color:#374151;">Use the code below to complete your sign-up. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:28px;text-align:center;margin:24px 0;">
          <span style="font-size:42px;font-weight:bold;letter-spacing:14px;color:#111827;">${sanitizeText(otp)}</span>
        </div>
        <p style="color:#6b7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Admin notification (generic)
// ---------------------------------------------------------------------------

const sendAdminNotification = async (subject, message) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    console.warn("No admin emails configured — skipping admin notification.");
    return;
  }
  await sendMail({
    from: `"Kifayat System" <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`,
    to: adminEmails,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#111827;margin-top:0;">${subject}</h2>
        <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:16px 0;">
          <p style="color:#374151;margin:0;line-height:1.6;">${message}</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">This is an automated notification from Kifayat.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Order confirmation
// ---------------------------------------------------------------------------

const sendOrderConfirmationEmail = async (to, name, order, shippingDetails) => {
  const orderItemsHtml = order.items
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:12px 0;font-size:14px;color:#111827;">${sanitizeText(item.name)} x ${item.quantity}</td>
      <td style="padding:12px 0;font-size:14px;color:#111827;text-align:right;">PKR ${Number(item.price * item.quantity).toLocaleString("en-PK")}</td>
    </tr>
  `
    )
    .join("");

  await sendMail({
    to,
    subject: `Order Confirmation #${order._id.toString().slice(-8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#111827;margin-top:0;">Order Placed Successfully</h2>
        <p style="color:#374151;">Hi <strong>${sanitizeText(name)}</strong>,</p>
        <p style="color:#374151;">Thank you for your order! Your order details are below:</p>

        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Order ID:</strong> #${order._id.toString().slice(-8).toUpperCase()}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString("en-PK")}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Total Amount:</strong> <span style="font-weight:bold;color:#111827;">PKR ${Number(order.totalAmount).toLocaleString("en-PK")}</span></p>
        </div>

        <h3 style="color:#111827;margin:0 0 12px;">Order Items</h3>
        <table style="width:100%;margin-bottom:24px;">
          <tbody>
            ${orderItemsHtml}
          </tbody>
        </table>

        <h3 style="color:#111827;margin:0 0 12px;">Shipping Details</h3>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Name:</strong> ${sanitizeText(shippingDetails.name)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Phone:</strong> ${sanitizeText(shippingDetails.phoneNumber)}${shippingDetails.phoneNumber2 ? ` / ${sanitizeText(shippingDetails.phoneNumber2)}` : ""}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Address:</strong> ${sanitizeText(shippingDetails.address)}, ${sanitizeText(shippingDetails.courierCity)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Ship Type:</strong> ${sanitizeText(shippingDetails.shpType)} — ${sanitizeText(shippingDetails.courierCompany)}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Payment:</strong> ${shippingDetails.shipping === "cod" ? "Cash on Delivery" : "Advance Payment"}</p>
        </div>

        <p style="color:#6b7280;font-size:14px;">We'll process your order shortly and keep you updated!</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Order confirmation link (10-minute window)
// ---------------------------------------------------------------------------

const sendOrderConfirmationLinkEmail = async (
  to,
  name,
  order,
  confirmationToken,
  requestBaseUrl,
) => {
  const frontendUrl = getConfirmationBaseUrl(requestBaseUrl);
  const confirmLink = `${frontendUrl}/confirm-order?token=${confirmationToken}`;
  const orderIdDisplay = `#${order._id.toString().slice(-8).toUpperCase()}`;

  const orderItemsHtml = order.items
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:12px 0;font-size:14px;color:#111827;">${sanitizeText(item.name)} x ${item.quantity}</td>
      <td style="padding:12px 0;font-size:14px;color:#111827;text-align:right;">PKR ${Number(item.price * item.quantity).toLocaleString("en-PK")}</td>
    </tr>
  `
    )
    .join("");

  await sendMail({
    to,
    subject: `Confirm your Kifayat order ${orderIdDisplay}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#111827;margin-top:0;">Confirm Your Order</h2>
        <p style="color:#374151;">Hi <strong>${sanitizeText(name)}</strong>,</p>
        <p style="color:#374151;">Your order has been received. Please confirm it within <strong>24 hours</strong> by clicking the button below. If you do not confirm, the order will be automatically cancelled.</p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${confirmLink}"
             style="display:inline-block;background:#16a34a;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
            Confirm Order
          </a>
        </div>

        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Order ID:</strong> ${orderIdDisplay}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString("en-PK")}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Total Amount:</strong> <span style="font-weight:bold;color:#111827;">PKR ${Number(order.totalAmount).toLocaleString("en-PK")}</span></p>
        </div>

        <h3 style="color:#111827;margin:0 0 12px;">Order Items</h3>
        <table style="width:100%;margin-bottom:24px;">
          <tbody>${orderItemsHtml}</tbody>
        </table>

        <p style="color:#6b7280;font-size:13px;">If you didn't place this order, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Late confirmation — stock unavailable
// ---------------------------------------------------------------------------

const sendLateConfirmationEmail = async (to, name, order) => {
  const orderIdDisplay = `#${(order._id || order).toString().slice(-8).toUpperCase()}`;

  await sendMail({
    to,
    subject: `Order ${orderIdDisplay} — Confirmation Failed`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#dc2626;margin-top:0;">Stock Unavailable</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">You confirmed your order <strong>${orderIdDisplay}</strong>, but unfortunately the stock is no longer available. This can happen when items sell out between the time you placed your order and when you confirmed it.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #fecaca;">
          <p style="margin:0;font-size:14px;color:#991b1b;"><strong>What now?</strong></p>
          <p style="margin:8px 0 0;font-size:14px;color:#991b1b;">Please try placing your order again later. We restock items regularly. If you have questions, reach out to our support team.</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">We apologise for the inconvenience.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Order cancelled due to stock exhaustion (after main order entry, before HSC)
// ---------------------------------------------------------------------------

const sendStockExhaustionEmail = async (to, name, order) => {
  const orderIdDisplay = `#${(order._id || order).toString().slice(-8).toUpperCase()}`;

  await sendMail({
    to,
    subject: `Order ${orderIdDisplay} — Cancelled Due to Stock Issue`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#dc2626;margin-top:0;">Order Cancelled</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">We regret to inform you that your order <strong>${orderIdDisplay}</strong> has been cancelled due to warehouse or revenue-related issues.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #fecaca;">
          <p style="margin:0;font-size:14px;color:#991b1b;"><strong>What happens next?</strong></p>
          <p style="margin:8px 0 0;font-size:14px;color:#991b1b;">We will notify you as soon as the stock is available again. You will not be charged for this order.</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">We apologise for the inconvenience and appreciate your patience.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Order cancellation (user-initiated)
// ---------------------------------------------------------------------------

const sendOrderCancelledByUserEmail = async (to, name, order) => {
  const orderIdDisplay = `#${(order._id || order).toString().slice(-8).toUpperCase()}`;

  await sendMail({
    to,
    subject: `Order ${orderIdDisplay} — Cancelled as Requested`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#111827;margin-top:0;">Order Cancelled</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">Your order <strong>${orderIdDisplay}</strong> has been cancelled as requested.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0;font-size:14px;color:#374151;">If you did not request this cancellation, please contact our support team immediately.</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">We hope to see you again soon!</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Insufficient stock cancellation (system-initiated)
// ---------------------------------------------------------------------------

const sendInsufficientStockEmail = async (to, name, order) => {
  const orderIdDisplay = `#${(order._id || order).toString().slice(-8).toUpperCase()}`;

  await sendMail({
    to,
    subject: `Order ${orderIdDisplay} — Cancelled Due to Insufficient Stock`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#dc2626;margin-top:0;">Insufficient Stock</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">We regret to inform you that your order <strong>${orderIdDisplay}</strong> has been cancelled due to insufficient stock.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #fecaca;">
          <p style="margin:0;font-size:14px;color:#991b1b;"><strong>What happens next?</strong></p>
          <p style="margin:8px 0 0;font-size:14px;color:#991b1b;">We will notify you as soon as the items are back in stock. You will not be charged for this order.</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">We apologise for the inconvenience and appreciate your patience.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Warehouse/Revenue cancellation with compensation vouchers
// ---------------------------------------------------------------------------

const sendCompensationEmail = async (to, name, order, vouchers) => {
  const orderIdDisplay = `#${(order._id || order).toString().slice(-8).toUpperCase()}`;

  let voucherRows = vouchers.map((v, i) => {
    if (v.voucher_type === "discount_all") {
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${i + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${v.discount_percent}% OFF</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">All products</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${new Date(v.expires_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</td>
      </tr>`;
    } else if (v.voucher_type === "discount_specific") {
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${i + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${v.discount_percent}% OFF</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">Specific products</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${new Date(v.expires_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</td>
      </tr>`;
    } else {
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${i + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">Free Product</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${v.products?.length ? v.products.map(p => p.name || "Selected product").join(", ") : "Selected product"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${new Date(v.expires_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</td>
      </tr>`;
    }
  }).join("");

  await sendMail({
    to,
    subject: `Order ${orderIdDisplay} — Cancelled — Compensation Vouchers Inside`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#111827;margin-top:0;">We Apologise</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">We regret to inform you that your order <strong>${orderIdDisplay}</strong> has been cancelled due to a warehouse or revenue-related issue.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #fecaca;">
          <p style="margin:0;font-size:14px;color:#991b1b;">As a token of apology, we have added compensation vouchers to your account. Use them on your next order!</p>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #e5e7eb;">
          <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">Your Compensation Vouchers</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#e5e7eb;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;text-transform:uppercase;">#</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;text-transform:uppercase;">Discount</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;text-transform:uppercase;">Applies To</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#374151;text-transform:uppercase;">Expires</th>
              </tr>
            </thead>
            <tbody>
              ${voucherRows}
            </tbody>
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">Log in to your account to view and apply your vouchers.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// Admin stock-alert email with "Gift them" action
// Sent when a customer confirms too late (pre-order) or a main-order item
// runs out of stock — lets the admin compensate the customer instantly.
// ---------------------------------------------------------------------------

const sendAdminStockAlertEmail = async ({
  orderId,
  customerName,
  customerEmail,
  orderType,
}) => {
  const orderDisplay = `#${String(orderId || "").slice(-8).toUpperCase()}`;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    console.warn("No admin emails configured — skipping admin stock alert email.");
    return;
  }

  await sendMail({
    from: `"Kifayat System" <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`,
    to: adminEmails,
    subject: `Late Confirmation — Order ${orderDisplay} Not Available`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2 style="color:#dc2626;margin-top:0;">Late Confirmation — Product Not Available</h2>
        <p style="color:#374151;">Customer <strong>${customerName || "—"}</strong> (${customerEmail || "no email on file"}) confirmed their order <strong>${orderDisplay}</strong>, but the product is no longer available on the website.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Order:</strong> ${orderDisplay}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Stage:</strong> ${orderType}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Customer:</strong> ${customerName || "—"} (${customerEmail || "no email on file"})</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Status:</strong> Late confirmation — stock not available. The order was not moved to main orders and will be managed manually.</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">You can compensate this customer manually — e.g. via the Gift button in User Management.</p>
        <p style="color:#6b7280;font-size:14px;">This is an automated notification from Kifayat.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Kifayat &mdash; Your financial companion</p>
      </div>
    `,
  });
};

module.exports = {
  sendMail,
  sendOTPEmail,
  sendOrderConfirmationEmail,
  sendAdminNotification,
  sendOrderConfirmationLinkEmail,
  sendLateConfirmationEmail,
  sendStockExhaustionEmail,
  sendOrderCancelledByUserEmail,
  sendInsufficientStockEmail,
  sendCompensationEmail,
  sendAdminStockAlertEmail,
  getConfirmationBaseUrl,
  getEmailProviderStatus,
  sanitizeText,
};
