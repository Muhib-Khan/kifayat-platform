const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");
const User = require("./models/User");
const authRoutes = require("./routes/authRoutes");
const { globalLimiter, authLimiter, otpLimiter, orderLimiter, tokenLinkLimiter, aiLimiter } = require("./middleware/rateLimiters");
const { isOriginAllowed } = require("./utils/corsConfig");
const { verifySessionToken } = require("./middleware/auth");
const { COOKIE_NAME } = require("./utils/cookies");
const requestLogger = require("./middleware/requestLogger");
const requireSameOrigin = require("./middleware/originGuard");
const { getEmailProviderStatus } = require("./utils/email");
const logger = require("./utils/logger");
const { captureException } = require("./utils/sentry");

// ---------------------------------------------------------------------------
// Global process handlers
// ---------------------------------------------------------------------------
process.on("unhandledRejection", (reason, promise) => {
  logger.error("UNHANDLED REJECTION", { reason, promise });
  captureException(new Error(`Unhandled Rejection: ${reason}`), { reason, promise });
});

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION", { error: err.message, stack: err.stack });
  captureException(err, { type: "uncaughtException" });
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Startup guards
// ---------------------------------------------------------------------------

// Infrastructure — server cannot work at all without these
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing critical env vars: ${missing.join(", ")}`);
  console.error("   Add them to kifayat-backend/.env and restart.");
  process.exit(1);
}

// Email — server starts without a provider, but transactional mail will fail.
function normalizeMailDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function extractEmailDomain(address) {
  const match = String(address || "").match(/<([^>]+)>/);
  const email = (match ? match[1] : String(address || "")).trim();
  const atIndex = email.lastIndexOf("@");
  return atIndex >= 0 ? normalizeMailDomain(email.slice(atIndex + 1)) : "";
}

function extractHost(value) {
  try {
    return normalizeMailDomain(new URL(value).hostname);
  } catch {
    return "";
  }
}

const emailStatus = getEmailProviderStatus();
const gmailPassHasWhitespace = /\s/.test(process.env.EMAIL_PASS || "");
const hasGmailEmail = emailStatus.hasGmail;
const hasResendEmail = emailStatus.hasResend;
const activeEmailProviders = [];
if (hasResendEmail) {
  activeEmailProviders.push(
    emailStatus.preferredProvider === "resend"
      ? "Resend (primary)"
      : "Resend (fallback)",
  );
}
if (hasGmailEmail) {
  activeEmailProviders.push(
    emailStatus.preferredProvider === "gmail"
      ? "Gmail SMTP (primary)"
      : "Gmail SMTP (fallback)",
  );
}

if (activeEmailProviders.length === 0) {
  console.warn(
    "⚠️  No email provider configured — signup OTPs, password OTPs, and order emails will not be sent.",
  );
  console.warn(
    "   Set EMAIL_USER/EMAIL_PASS or RESEND_API_KEY to enable transactional email.",
  );
} else {
  console.log(`📧 Email delivery enabled: ${activeEmailProviders.join(" + ")}`);
}

if (process.env.NODE_ENV === "production" && hasGmailEmail && emailStatus.preferredProvider === "gmail") {
  console.warn(
    "⚠️  Gmail SMTP is still the primary production sender. Use a verified branded domain sender for better inbox placement.",
  );
}

if (process.env.NODE_ENV === "production" && hasResendEmail && emailStatus.resendFromIsGeneric) {
  console.warn(
    "⚠️  RESEND_FROM_EMAIL is missing or generic. Set it to a verified branded domain address before relying on Resend in production.",
  );
}

if (hasResendEmail && !emailStatus.resendFromIsGeneric) {
  const appDomain = extractHost(
    process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.SITE_URL,
  );
  const senderDomain = extractEmailDomain(emailStatus.resendFrom);
  const domainsAlign =
    !appDomain || !senderDomain ||
    senderDomain.endsWith(appDomain) ||
    appDomain.endsWith(senderDomain);

  if (!domainsAlign) {
    console.warn(
      `⚠️  RESEND_FROM_EMAIL domain (${senderDomain}) does not line up with the storefront URL (${appDomain || "unknown"}). Use the same branded domain and verify SPF, DKIM, and DMARC.`,
    );
  }
}

if (hasGmailEmail && gmailPassHasWhitespace) {
  console.warn(
    "⚠️  EMAIL_PASS contains whitespace; Gmail app passwords should be pasted without spaces.",
  );
}

// Admin emails
if (!process.env.ADMIN_EMAILS) {
  console.warn("⚠️  ADMIN_EMAILS not set — no one will have admin role.");
  console.warn("   Add ADMIN_EMAILS=a@b.com,c@d.com to kifayat-backend/.env");
} else {
  const adminEmails = process.env.ADMIN_EMAILS.split(",").map((e) => e.trim());
  const invalidEmails = adminEmails.filter(
    (e) => !e.includes("@") || e.split("@").length > 2,
  );
  if (invalidEmails.length > 0) {
    console.warn(
      `⚠️  Some ADMIN_EMAILS entries are invalid: ${invalidEmails.join(", ")}`,
    );
  }
}

// Production URL validation
if (process.env.NODE_ENV === "production") {
  const publicUrl = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.SITE_URL;
  if (!publicUrl) {
    console.error("❌ PUBLIC_APP_URL/FRONTEND_URL/SITE_URL is not set in production. Emailed links will be broken.");
  } else if (publicUrl.includes("localhost") || publicUrl.includes("127.0.0.1")) {
    console.error("❌ PUBLIC_APP_URL points to localhost in production. This must be a production URL.");
  } else if (!publicUrl.startsWith("https://")) {
    console.warn(`⚠️  PUBLIC_APP_URL does not use HTTPS in production: ${publicUrl}. Consider using HTTPS for better security and email deliverability.`);
  }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
connectDB().then(ensureFaizSeller).catch((error) => {
  console.error("Failed to provision Faiz's Store seller account:", error);
});

// Provision the dedicated seller account on first boot. The password is stored
// only as a bcrypt hash; existing accounts are never overwritten.
async function ensureFaizSeller() {
  const email = "faiz@kifayat.co";
  const passwordHash = "$2b$12$H.5qW8pPeTzCAPOhjEalCeZbQWivmX7Q39C5j0HCRZlT1u9DAPXZG";
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: "Faiz",
      email,
      password: passwordHash,
      gender: "Prefer not to say",
      authProvider: "email",
      isVerified: true,
      role: "seller",
      storeName: "Faiz's Store",
      storeSlug: "faizs-store",
    });
    console.log("✅ Faiz's Store seller account provisioned.");
    return;
  }
  const updates = {};
  if (existing.role !== "seller") updates.role = "seller";
  if (existing.storeName !== "Faiz's Store") updates.storeName = "Faiz's Store";
  if (existing.storeSlug !== "faizs-store") updates.storeSlug = "faizs-store";
  if (Object.keys(updates).length > 0) {
    await User.updateOne({ _id: existing._id }, { $set: updates });
    console.log("✅ Faiz's Store seller profile synchronized.");
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
// Trust the reverse proxy (Replit / nginx) so express-rate-limit can read
// the real client IP from X-Forwarded-For without throwing a validation error.
app.set("trust proxy", 1);
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Security headers
// Helmet is great for security, but its default Cross-Origin-Opener-Policy
// of "same-origin" breaks Firebase Google sign-in popups.
// We override it to "same-origin-allow-popups" so the popup can communicate
// back to the main page after the user authenticates with Google.
// ---------------------------------------------------------------------------
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ---------------------------------------------------------------------------
// Sentry error handling (only in production with SENTRY_DSN)
// ---------------------------------------------------------------------------
if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  const { Sentry } = require("./utils/sentry");
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// ---------------------------------------------------------------------------
// CORS — explicit allowlist only (see utils/corsConfig.js). No wildcard domains.
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Socket.IO setup
// ---------------------------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
  },
});

// Parse the auth token from the handshake — httpOnly cookie (same-origin,
// sent by socket.io-client with withCredentials) or handshake.auth.token.
const getSocketToken = (socket) => {
  const fromAuth = socket.handshake.auth && socket.handshake.auth.token;
  if (fromAuth) return fromAuth;
  const cookieHeader = socket.handshake.headers && socket.handshake.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
};

// Authenticate every socket connection against the same JWT + Session store
// used by the HTTP protect middleware. Anonymous visitors are allowed through
// (socket.data.user = null) so public realtime events like products_updated
// reach every shopper; privileged actions (chat:join) enforce their own checks.
io.use(async (socket, next) => {
  try {
    const token = getSocketToken(socket);
    if (!token) {
      socket.data.user = null;
      return next();
    }
    const user = await verifySessionToken(token);
    if (!user) {
      return next(new Error("Unauthorized"));
    }
    socket.data.user = user;
    next();
  } catch (err) {
    console.error("Socket.IO auth error:", err);
    next(new Error("Authentication failed"));
  }
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Auto-join personal room so controllers can emit to specific users
  const user = socket.data.user;
  if (user) {
    socket.join(`user-${user._id}`);
    if (user.role === "admin") {
      socket.join("admin");
    }
  }

  // Join defective product report room for chat — only the report owner or an
  // admin may join, and only for report IDs that actually exist.
  socket.on("chat:join", async (reportId) => {
    if (!reportId || typeof reportId !== "string" || !/^[0-9a-fA-F]{24}$/.test(reportId)) {
      socket.emit("chat:error", { message: "Invalid report id." });
      return;
    }
    try {
      const DefectiveProductReport = require("./models/DefectiveProductReport");
      const report = await DefectiveProductReport.findById(reportId);
      const user = socket.data.user;
      if (!user) {
        socket.emit("chat:error", { message: "You must be signed in to join the chat." });
        return;
      }
      if (!report) {
        socket.emit("chat:error", { message: "Report not found." });
        return;
      }
      const isAdmin = user.role === "admin";
      const isOwner = report.user && String(report.user) === String(user._id);
      if (!isAdmin && !isOwner) {
        socket.emit("chat:error", { message: "You are not part of this report." });
        return;
      }
      socket.join(`defective-${reportId}`);
      console.log(`Socket ${socket.id} joined defective-${reportId}`);
    } catch (err) {
      console.error("chat:join error:", err);
      socket.emit("chat:error", { message: "Failed to join chat." });
    }
  });

  socket.on("chat:leave", (reportId) => {
    if (reportId) {
      socket.leave(`defective-${reportId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Make io available to controllers
app.set("io", io);

// ---------------------------------------------------------------------------
// Body parsing & cookies
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static("uploads"));
app.use(cookieParser());
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Compression (gzip / brotli)
// ---------------------------------------------------------------------------
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// ---------------------------------------------------------------------------
// Cache-Control headers for API responses
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else {
    res.set("Cache-Control", "no-store");
  }
  // Security headers not already set by helmet
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Explicitly set X-Content-Type-Options (Helmet sets it by default, but be explicit)
  res.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking — same-origin only (affects iframes, not the popup auth flow)
  res.set("X-Frame-Options", "same-origin");
  next();
});

// ---------------------------------------------------------------------------
// Rate limiters (defined in middleware/rateLimiters.js)
// ---------------------------------------------------------------------------
app.use(globalLimiter);

// ---------------------------------------------------------------------------
// Sentry error handler (must be before routes)
// ---------------------------------------------------------------------------
if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  const { Sentry } = require("./utils/sentry");
  app.use(Sentry.Handlers.errorHandler());
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ success: true, message: "Kifayat Backend Running" });
});

app.get("/api/health", async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Get database stats
    let dbStats = {};
    try {
      if (mongoose.connection.readyState === 1) {
        const db = mongoose.connection.db;
        const stats = await db.stats();
        dbStats = {
          collections: stats.collections,
          dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
          storageSize: `${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`,
          indexes: stats.indexes,
          indexSize: `${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`,
        };
      }
    } catch (err) {
      logger.error('Failed to get database stats', { error: err.message });
    }

    // System metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: {
        used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      },
      cpu: process.cpuUsage(),
    };

    res.json({
      success: true,
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        stats: dbStats,
      },
      email: emailStatus,
      system: systemMetrics,
      version: require('./package.json').version,
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      success: false,
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Firebase Admin diagnostic — shows which project the backend is using.
// Helps confirm that the right service account is loaded after a restart.
app.get("/api/health/firebase", (req, res) => {
  const { getActiveProjectId } = require("./config/firebaseAdmin");
  const projectId = getActiveProjectId();
  res.json({
    success: true,
    firebase: {
      initialized: projectId !== null,
      projectId:
        projectId || "NOT INITIALIZED — check backend console for ❌ errors",
    },
  });
});

// Backup status endpoint
app.get("/api/health/backups", async (req, res) => {
  try {
    const { listBackups } = require("./scripts/backup");
    const backups = listBackups();
    
    res.json({
      success: true,
      backups: {
        count: backups.length,
        latest: backups.length > 0 ? backups[0] : null,
        totalSize: `${backups.reduce((sum, b) => sum + b.size, 0) / 1024 / 1024} MB`,
        list: backups.slice(0, 10), // Return last 10 backups
      },
    });
  } catch (error) {
    logger.error('Backup status check failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Sitemap helpers
// ---------------------------------------------------------------------------
function xmlUrl({ loc, lastmod, changefreq, priority, image } = {}) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>` : "",
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority ? `    <priority>${priority}</priority>` : "",
    image
      ? `    <image:image>\n      <image:loc>${image.loc}</image:loc>\n      <image:title>${image.title}</image:title>\n    </image:image>`
      : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function xmlEscape(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Canonical production URL — always www.kifayat.co regardless of dev proxy
const { CANONICAL_URL } = require("./utils/appUrl");

// ---------------------------------------------------------------------------
// Sitemap index — lists all sub-sitemaps
// ---------------------------------------------------------------------------
app.get("/sitemap.xml", (req, res) => {
  const SITE_URL = CANONICAL_URL;
  const now = new Date().toISOString().split("T")[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-products.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-categories.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/image-sitemap.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;
  res.header("Content-Type", "application/xml");
  res.header("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ---------------------------------------------------------------------------
// Pages sitemap (static + blog)
// ---------------------------------------------------------------------------
app.get("/sitemap-pages.xml", (req, res) => {
  const SITE_URL = CANONICAL_URL;
  const now = new Date().toISOString();

  const pages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/products", priority: "0.9", changefreq: "daily" },
    { loc: "/about", priority: "0.7", changefreq: "monthly" },
    { loc: "/contact", priority: "0.6", changefreq: "monthly" },
    { loc: "/faq", priority: "0.7", changefreq: "monthly" },
    { loc: "/blog", priority: "0.7", changefreq: "weekly" },
    { loc: "/search", priority: "0.5", changefreq: "weekly" },
    { loc: "/blog/wireless-earbuds-under-5000", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/phones-under-30000", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/sneakers-under-5000", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/shoe-size-guide", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/induction-cooktop-under-15000", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/face-wash-oily-skin", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/cod-shopping-guide", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/buying-electronics-online", priority: "0.6", changefreq: "monthly" },
    { loc: "/blog/watches-under-5000", priority: "0.6", changefreq: "monthly" },
    { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
    { loc: "/terms", priority: "0.3", changefreq: "yearly" },
    { loc: "/return-policy", priority: "0.5", changefreq: "monthly" },
    { loc: "/shipping-policy", priority: "0.5", changefreq: "monthly" },
  ];

  const urls = pages
    .map((p) => xmlUrl({ loc: `${SITE_URL}${p.loc}`, lastmod: now, changefreq: p.changefreq, priority: p.priority }))
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  res.header("Content-Type", "application/xml");
  res.header("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ---------------------------------------------------------------------------
// Products sitemap (dynamic — all in-stock products)
// ---------------------------------------------------------------------------
app.get("/sitemap-products.xml", async (req, res) => {
  try {
    const Product = require("./models/Product");
    const SITE_URL = CANONICAL_URL;

    const products = await Product.find({ stock: { $gt: 0 } })
      .select("_id slug name updatedAt imageUrl")
      .sort({ salesCount: -1, updatedAt: -1 })
      .lean();

    // The site links to products by slug (/products/<slug>) — the product
    // detail route resolves slugs too. Emit slug URLs so sitemap locs match
    // the site's real (canonical) links; fall back to _id for the rare
    // product with no slug. No cap: every in-stock product belongs in the
    // sitemap. The frontend prerender focuses static HTML on the top N (the
    // sitemap is already sorted by salesCount desc, so the most valuable
    // products come first).
    const urls = products
      .map((p) =>
        xmlUrl({
          loc: `${SITE_URL}/products/${p.slug || p._id}`,
          lastmod: p.updatedAt,
          changefreq: "daily",
          priority: "0.8",
        }),
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;
    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("Products sitemap error:", err);
    res.status(500).json({ success: false, message: "Products sitemap failed" });
  }
});

// ---------------------------------------------------------------------------
// Categories sitemap (dynamic)
// ---------------------------------------------------------------------------
app.get("/sitemap-categories.xml", async (req, res) => {
  try {
    const Category = require("./models/Category");
    const SITE_URL = CANONICAL_URL;

    const categories = await Category.find({}).select("slug updatedAt").lean();

    const urls = categories
      .filter((c) => c.slug)
      .map((c) =>
        xmlUrl({
          loc: `${SITE_URL}/category/${c.slug}`,
          lastmod: c.updatedAt,
          changefreq: "weekly",
          priority: "0.7",
        }),
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("Categories sitemap error:", err);
    res.status(500).json({ success: false, message: "Categories sitemap failed" });
  }
});

// ---------------------------------------------------------------------------
// Image Sitemap
// ---------------------------------------------------------------------------
app.get("/image-sitemap.xml", async (req, res) => {
  try {
    const Product = require("./models/Product");
    const SITE_URL = CANONICAL_URL;

    const products = await Product.find({
      imageUrl: { $ne: "", $exists: true },
    })
      .select("slug imageUrl name")
      .lean();

    const escape = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const imageUrls = products
      .filter((p) => p.imageUrl)
      .map((p) => {
        const firstImage = p.imageUrl.split(",")[0].trim();
        const safeName = escape(p.name);
        return `  <url>
    <loc>${SITE_URL}/products/${p.slug || p._id}</loc>
    <image:image>
      <image:loc>${firstImage}</image:loc>
      <image:title>${safeName}</image:title>
      <image:caption>${safeName} — available at Kifayat, Pakistan's trusted online store.</image:caption>
    </image:image>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${imageUrls}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=7200");
    res.send(xml);
  } catch (err) {
    console.error("Image sitemap error:", err);
    res.status(500).json({ success: false, message: "Image sitemap failed" });
  }
});

// ---------------------------------------------------------------------------
// Robots.txt
// ---------------------------------------------------------------------------
app.get("/robots.txt", (req, res) => {
  res.header("Content-Type", "text/plain");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(`# Kifayat robots.txt
# https://www.kifayat.co

User-agent: *
Allow: /
Allow: /products/
Allow: /category/
Allow: /blog/
Allow: /search
Allow: /about
Allow: /contact
Allow: /faq
Allow: /privacy
Allow: /terms
Allow: /return-policy
Allow: /shipping-policy
Disallow: /admin
Disallow: /admin/
Disallow: /cart
Disallow: /checkout
Disallow: /account/
Disallow: /profile
Disallow: /api/
Disallow: /*?*sort=
Disallow: /*?*page=
Crawl-delay: 2

# Googlebot — full access to all indexable pages
User-agent: Googlebot
Allow: /
Allow: /products/
Allow: /category/
Allow: /blog/
Disallow: /admin
Disallow: /cart
Disallow: /checkout
Disallow: /account/
Disallow: /api/

# Googlebot-Image — full access to product images
User-agent: Googlebot-Image
Allow: /

# Bingbot
User-agent: Bingbot
Allow: /
Disallow: /admin
Disallow: /cart
Disallow: /checkout
Disallow: /account/
Disallow: /api/
Crawl-delay: 5

# Yandex
User-agent: Yandex
Allow: /
Disallow: /admin
Disallow: /cart
Disallow: /checkout
Disallow: /account/
Disallow: /api/
Crawl-delay: 5

# Bad bots — block scrapers and AI crawlers that don't respect content
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${CANONICAL_URL}/sitemap.xml
Sitemap: ${CANONICAL_URL}/sitemap-pages.xml
Sitemap: ${CANONICAL_URL}/sitemap-products.xml
Sitemap: ${CANONICAL_URL}/sitemap-categories.xml
Sitemap: ${CANONICAL_URL}/image-sitemap.xml
`);
});

// Apply rate limits
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/auth/verify-otp", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/forgot-password", otpLimiter);
app.use("/api/auth/reset-password", otpLimiter);
app.use("/api/auth/verify-password-update", otpLimiter);
app.use("/api/orders/shipping-otp", otpLimiter);
app.use("/api/orders/verify-shipping-otp", otpLimiter);
app.use("/api/orders", orderLimiter);

const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const cartRoutes = require("./routes/cartRoutes");
const diagnosticRoutes = require("./routes/diagnosticRoutes");
const sellerRoutes = require("./routes/sellerRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/sellers", sellerRoutes);
// CSRF: block cross-site requests on all admin routes (state-changing + read)
app.use("/api/admin", requireSameOrigin);
app.use("/api/admin/users", userRoutes);
// CSRF on authenticated state-changing routes
app.use("/api/orders", requireSameOrigin, orderRoutes);
app.use("/api/reviews", requireSameOrigin, reviewRoutes);
app.use("/api/cart", requireSameOrigin, cartRoutes);
app.use("/api/admin/activity-logs", require("./routes/activityLogRoutes"));
app.use("/api/admin/export-csv", require("./routes/csvExportRoutes"));
app.use("/api/admin/order-status", require("./routes/orderStatusRoutes"));
app.use("/api/website-reviews", require("./routes/websiteReviewRoutes"));
app.use("/api/admin/users-final-data", require("./routes/userFinalDataRoutes"));
app.use("/api/admin/diagnostic", diagnosticRoutes);
app.use("/api/hhc-proxy", require("./routes/hhcApiRoutes"));
app.use("/api/admin/settings", require("./routes/settingsRoutes"));
app.use("/api/admin/price-ranges", require("./routes/priceRangeRoutes"));
app.use("/api/admin/ai", aiLimiter, require("./routes/aiRoutes"));
app.use("/api/workflow", require("./routes/orderWorkflowRoutes"));
app.use("/api/defective-products", requireSameOrigin, require("./routes/defectiveProductRoutes"));
app.use("/api/vouchers", requireSameOrigin, require("./routes/voucherRoutes"));
app.use("/api/receipts", requireSameOrigin, require("./routes/receiptRoutes"));
// Public settings (no auth) — storefront reads the flat delivery fee here
app.use("/api/settings", require("./routes/publicSettingsRoutes"));

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith("CORS:")) {
    return res.status(403).json({ success: false, message: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON in request body." });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "File too large." });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdownGracefully() {
  console.log("\nShutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed.");
    mongoose.connection.close(false).then(() => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", shutdownGracefully);
process.on("SIGTERM", shutdownGracefully);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(
    `🚀 Server on port ${PORT} [${process.env.NODE_ENV || "development"}]`,
  );
  // Restore out-of-stock deletion timers for products that were pending on shutdown
  try {
    const { restorePendingOnStartup } = require("./utils/outOfStockManager");
    await restorePendingOnStartup(app.get('io'));
  } catch (err) {
    console.error("Failed to restore out-of-stock timers:", err);
  }

  // Start price diagnostic — runs every 10 minutes (not every 15s to avoid spam)
  try {
    const { autoDiagnostic } = require("./controllers/diagnosticController");
    let diagnosticRunning = false;
    const DIAGNOSTIC_INTERVAL = 10 * 60 * 1000; // 10 minutes
    const runDiagnosticSafe = async () => {
      if (diagnosticRunning) return;
      diagnosticRunning = true;
      try {
        await autoDiagnostic();
      } finally {
        diagnosticRunning = false;
      }
    };
    // First run after 2 minutes, then every 10 minutes
    setTimeout(() => {
      console.log("[PriceDiagnostic] Monitor started (every 10 min)...");
      runDiagnosticSafe();
      setInterval(runDiagnosticSafe, DIAGNOSTIC_INTERVAL);
    }, 2 * 60 * 1000);
    console.log("  🔍 Price diagnostic monitor: every 10 min");
  } catch (err) {
    console.error("Failed to start price diagnostic monitor:", err);
  }

  // Start active user monitor for CSV upload reminders
  try {
    const { startMonitor } = require("./utils/activeUserMonitor");
    startMonitor();
  } catch (err) {
    console.error("Failed to start active user monitor:", err);
  }

  // Restore pending PreOrder timers
  try {
    const { restorePendingPreOrders } = require("./controllers/orderController");
    await restorePendingPreOrders();
  } catch (err) {
    console.error("Failed to restore pending pre-orders:", err);
  }

  // Start voucher reservation sweeper — releases stale reservations from
  // abandoned checkouts so users get their uses back automatically
  try {
    const { startVoucherReservationSweeper } = require("./controllers/voucherController");
    startVoucherReservationSweeper();
  } catch (err) {
    console.error("Failed to start voucher reservation sweeper:", err);
  }

  // Start backup scheduler — daily MongoDB backups at 2:00 AM
  try {
    const cron = require('node-cron');
    const { main: performBackup } = require("./scripts/backup");
    
    // Schedule daily backup at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Starting scheduled daily backup');
        await performBackup();
        logger.info('Scheduled backup completed successfully');
      } catch (error) {
        logger.error('Scheduled backup failed', { error: error.message });
        // Don't crash the server if backup fails
      }
    }, {
      timezone: 'Asia/Karachi'
    });
    
    logger.info("Backup scheduler started - Daily backup at 2:00 AM (Asia/Karachi)");
  } catch (err) {
    logger.error("Failed to start backup scheduler:", err);
    // Don't crash the server if scheduler fails to start
  }
});
