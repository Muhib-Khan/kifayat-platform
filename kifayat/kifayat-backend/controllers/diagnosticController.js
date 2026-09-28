const Product = require("../models/Product");
const PriceDiagnostic = require("../models/PriceDiagnostic");
const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");
const { logActivity } = require("../utils/activityLogger");
const { sendMail } = require("../utils/email");
const { loadPricingRules, priceProductFromRules } = require("../utils/pricing");

// ── Helpers ──────────────────────────────────────────────────────────────────

const getAdminEmails = async () => {
  try {
    const admins = await User.find({ role: "admin" }).select("email").lean();
    const emails = admins.map((u) => u.email).filter(Boolean);
    if (emails.length > 0) return emails;
  } catch {}
  const env = process.env.ADMIN_EMAILS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

const findUnsetPrices = async () => {
  const products = await Product.find({
    wholesalePrice: { $gt: 0 },   // skip products with no wholesale price — can't compute markup
    $or: [
      { retailPrice: { $eq: 0 } },
      { retailPrice: null },
      { retailPrice: { $exists: false } },
    ],
  }).lean();

  return products.map((p) => ({
    productId: p._id,
    productName: p.name,
    productSku: p.sku || "",
    wholesalePrice: p.wholesalePrice || 0,
    retailPrice: p.retailPrice || 0,
    category: p.category || "Uncategorized",
    status: "pending",
  }));
};

// ── Run Diagnostic ───────────────────────────────────────────────────────────

const runDiagnostic = async (req, res) => {
  try {
    const issues = await findUnsetPrices();
    const status = issues.length === 0 ? "resolved" : "pending";
    const token = issues.length > 0 ? uuidv4() : "";

    const diagnostic = await PriceDiagnostic.create({
      runAt: new Date(),
      status,
      confirmToken: token,
      issues,
      triggeredBy: req?.user ? "manual" : "auto",
    });

    // Send email notification if issues were found (fire-and-forget)
    if (issues.length > 0) {
      sendDiagnosticEmail(diagnostic).catch((err) =>
        console.error("[runDiagnostic] email send failed:", err)
      );
    }

    return res.status(200).json({
      success: true,
      diagnostic: {
        _id: diagnostic._id,
        runAt: diagnostic.runAt,
        status: diagnostic.status,
        issues: diagnostic.issues,
        totalIssues: issues.length,
        confirmToken: token,
      },
    });
  } catch (err) {
    console.error("runDiagnostic error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to run diagnostic." });
  }
};

// ── Get Latest Diagnostic ────────────────────────────────────────────────────

const getLatestDiagnostic = async (req, res) => {
  try {
    const latest = await PriceDiagnostic.findOne()
      .sort({ runAt: -1 })
      .lean();
    return res.status(200).json({ success: true, diagnostic: latest || null });
  } catch (err) {
    console.error("getLatestDiagnostic error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch diagnostic." });
  }
};

// ── Set Product Price from Diagnostic ────────────────────────────────────────

const setProductPrice = async (req, res) => {
  try {
    const { diagnosticId, productId, retailPrice } = req.body;
    if (!diagnosticId || !productId || retailPrice === undefined || retailPrice === null) {
      return res
        .status(400)
        .json({ success: false, message: "diagnosticId, productId, and retailPrice are required." });
    }
    if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const price = Number(retailPrice);
    if (!Number.isFinite(price) || price < 0) {
      return res
        .status(400)
        .json({ success: false, message: "retailPrice must be a finite non-negative number." });
    }
    if (price > 1e9) {
      return res
        .status(400)
        .json({ success: false, message: "retailPrice must not exceed 1,000,000,000" });
    }

    // Update product
    const product = await Product.findByIdAndUpdate(
      productId,
      { retailPrice: price },
      { new: true }
    );
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    // Update diagnostic issue status
    const diagnostic = await PriceDiagnostic.findById(diagnosticId);
    if (diagnostic) {
      const issue = diagnostic.issues.find(
        (i) => i.productId.toString() === productId.toString()
      );
      if (issue) {
        issue.status = "fixed";
        issue.retailPrice = price;
        diagnostic.fixedCount = (diagnostic.fixedCount || 0) + 1;
        await diagnostic.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Price set to PKR ${price} for "${product.name}".`,
      product,
    });
  } catch (err) {
    console.error("setProductPrice error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to set product price." });
  }
};

// ── Confirm Diagnostic (email link) ──────────────────────────────────────────

const confirmDiagnostic = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).send("<h2>Invalid confirmation link.</h2>");
    }

    const diagnostic = await PriceDiagnostic.findOne({ confirmToken: token });
    if (!diagnostic) {
      return res.status(404).send("<h2>Confirmation link expired or invalid.</h2>");
    }

    if (diagnostic.acknowledged) {
      return res.send(`
        <html>
          <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;">
            <div style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px;">
              <h2 style="color:#111827;margin:0 0 8px;">Already Confirmed ✓</h2>
              <p style="color:#6b7280;margin:0;">This diagnostic issue was already acknowledged.</p>
            </div>
          </body>
        </html>
      `);
    }

    diagnostic.acknowledged = true;
    diagnostic.acknowledgedBy = req.query.email || "admin";
    diagnostic.acknowledgedAt = new Date();
    diagnostic.status = "acknowledged";
    await diagnostic.save();

    res.send(`
      <html>
        <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;">
          <div style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px;">
            <div style="font-size:48px;margin-bottom:16px;">✅</div>
            <h2 style="color:#111827;margin:0 0 8px;">Confirmed!</h2>
            <p style="color:#6b7280;margin:0 0 16px;">You've acknowledged the price diagnostic issues. Please check the admin panel to fix them.</p>
            <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}" 
               style="display:inline-block;padding:10px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
              Go to Admin Panel
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("confirmDiagnostic error:", err);
    res.status(500).send("<h2>Something went wrong. Please try again.</h2>");
  }
};

// ── Auto-apply Global Pricing ────────────────────────────────────────────────

const applyGlobalPricing = async (diagnosticId) => {
  try {
    const diagnostic = await PriceDiagnostic.findById(diagnosticId);
    if (!diagnostic || diagnostic.acknowledged || diagnostic.autoApplied) return;

    const rules = await loadPricingRules();
    const globalPct = rules.globalPricing;
    const hasPricingConfig =
      globalPct != null ||
      (rules.priceRanges && rules.priceRanges.length > 0);
    if (!hasPricingConfig) {
      console.warn("auto-apply: no global pricing or price ranges set, skipping");
      return;
    }

    let applied = 0;
    for (const issue of diagnostic.issues) {
      if (issue.status !== "pending") continue;
      const wholesale = issue.wholesalePrice || 0;
      const priced = priceProductFromRules(wholesale, issue.category, false, rules);
      if (!priced) continue; // wholesale <= 0 — cannot price, leave issue pending
      await Product.findByIdAndUpdate(issue.productId, {
        retailPrice: priced.retail,
        lowPrice: priced.lowPrice,
      });
      issue.status = "fixed";
      issue.retailPrice = priced.retail;
      applied++;
    }

    diagnostic.autoApplied = true;
    diagnostic.autoAppliedAt = new Date();
    diagnostic.fixedCount = (diagnostic.fixedCount || 0) + applied;
    diagnostic.status = "auto_applied";
    await diagnostic.save();

    console.log(
      `[PriceDiagnostic] Auto-applied global ${globalPct}% to ${applied} products (diagnostic ${diagnosticId})`
    );
  } catch (err) {
    console.error("applyGlobalPricing error:", err);
  }
};

const { getAppUrl } = require("../utils/appUrl");

// ── Send Admin Email ─────────────────────────────────────────────────────────

const sendDiagnosticEmail = async (diagnostic, reminderNum = 1, totalReminders = 3) => {
  try {
    const backendUrl = getAppUrl();
    const confirmUrl = `${backendUrl}/api/admin/diagnostic/confirm/${diagnostic.confirmToken}`;

    const issueRows = diagnostic.issues
      .slice(0, 20)
      .map(
        (i, idx) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${idx + 1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${i.productName}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${i.productSku || "—"}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">PKR ${i.wholesalePrice}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#ef4444;font-weight:600;">Not Set</td>
          </tr>`
      )
      .join("");

    const totalIssues = diagnostic.issues.length;
    const moreText =
      totalIssues > 20
        ? `<p style="color:#6b7280;font-size:13px;">...and ${totalIssues - 20} more products.</p>`
        : "";

    const emails = await getAdminEmails();
    if (emails.length === 0) {
      console.warn("[PriceDiagnostic] No admin emails found");
      return;
    }

    for (const email of emails) {
      try {
        const personalConfirmUrl = `${confirmUrl}?email=${encodeURIComponent(email)}`;
        const reminderLabel = reminderNum > 1 ? ` (Reminder ${reminderNum}/${totalReminders})` : '';
        const minutesLeft = (totalReminders - reminderNum) * 3;
        const timeMsg = minutesLeft > 0
          ? `Auto-applied in <strong>~${minutesLeft} minutes</strong> if not acknowledged.`
          : `Auto-applying global pricing <strong>now</strong>.`;

        await sendMail({
          to: [email],
          subject: `⚠️ ${totalIssues} product(s) have unset prices — Action needed${reminderLabel}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:40px;margin-bottom:8px;">🔍</div>
                <h2 style="color:#111827;margin:0;">Price Diagnostic Alert${reminderLabel}</h2>
              </div>
              <p style="color:#374151;">Hi Admin,</p>
              <p style="color:#374151;">The automated price diagnostic found <strong style="color:#ef4444;">${totalIssues} product(s)</strong> with unset retail prices.</p>
              <p style="color:#374151;">${timeMsg}</p>
              
              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">#</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Product</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">SKU</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Wholesale</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Retail</th>
                  </tr>
                </thead>
                <tbody>
                  ${issueRows}
                </tbody>
              </table>
              ${moreText}

              <div style="text-align:center;margin:28px 0;">
                <a href="${personalConfirmUrl}" 
                   style="display:inline-block;padding:14px 32px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
                  ✓ OK, I will check
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px;text-align:center;">
                After ${totalReminders} reminders, the global website markup will be automatically applied to these products based on their wholesale price.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
                Kifayat — Automated Price Diagnostic System
              </p>
            </div>
          `,
        });
        console.log(`[PriceDiagnostic] Email sent to ${email}${reminderLabel}`);
      } catch (err) {
        console.error(`[PriceDiagnostic] Failed to email ${email}:`, err);
      }
    }
  } catch (err) {
    console.error("sendDiagnosticEmail error:", err);
  }
};

// ── Auto Diagnostic Run (called by cron) ─────────────────────────────────────

const autoDiagnostic = async () => {
  try {
    console.log("[PriceDiagnostic] Auto-run started...");
    const issues = await findUnsetPrices();
    if (issues.length === 0) {
      console.log("[PriceDiagnostic] No issues found.");
      // Create a clean resolved diagnostic entry
      await PriceDiagnostic.create({
        runAt: new Date(),
        status: "resolved",
        issues: [],
        triggeredBy: "auto",
      });
      return;
    }

    // ── EMAIL SPAM GUARD ──────────────────────────────────────────────────────
    // Don't send a new email if there's already an unresolved auto-diagnostic
    // from the last 2 hours. The admin will see it when they log in.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const activePending = await PriceDiagnostic.findOne({
      triggeredBy: "auto",
      runAt: { $gt: twoHoursAgo },
      status: { $in: ["pending", "auto_applied"] },
      acknowledged: { $ne: true },
    }).sort({ runAt: -1 });

    if (activePending) {
      console.log(
        `[PriceDiagnostic] Active unresolved diagnostic exists (${activePending._id}) — skipping email to avoid spam.`
      );
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const token = uuidv4();
    const diagnostic = await PriceDiagnostic.create({
      runAt: new Date(),
      status: "pending",
      confirmToken: token,
      issues,
      triggeredBy: "auto",
    });

    console.log(
      `[PriceDiagnostic] Found ${issues.length} issue(s). Sending email 1/3...`
    );
    await sendDiagnosticEmail(diagnostic, 1, 3);

    const sendReminder = async (reminderNum) => {
      try {
        const current = await PriceDiagnostic.findById(diagnostic._id);
        if (!current || current.acknowledged || current.autoApplied) {
          console.log(
            `[PriceDiagnostic] Diagnostic ${diagnostic._id} already resolved — not sending reminder ${reminderNum}/3.`
          );
          return;
        }
        console.log(
          `[PriceDiagnostic] Sending reminder ${reminderNum}/3...`
        );
        await sendDiagnosticEmail(diagnostic, reminderNum, 3);
      } catch (err) {
        console.error(`[PriceDiagnostic] Reminder ${reminderNum}/3 error:`, err);
      }
    };

    // Reminder 2/3 after 3 minutes
    setTimeout(() => sendReminder(2), 3 * 60 * 1000);
    // Reminder 3/3 after 6 minutes
    setTimeout(() => sendReminder(3), 6 * 60 * 1000);
    // Auto-apply global pricing after 9 minutes if no response
    setTimeout(async () => {
      try {
        const current = await PriceDiagnostic.findById(diagnostic._id);
        if (current && !current.acknowledged && !current.autoApplied) {
          console.log(
            `[PriceDiagnostic] No admin acknowledged after 3 reminders. Auto-applying global pricing...`
          );
          await applyGlobalPricing(diagnostic._id);
        } else {
          console.log(
            `[PriceDiagnostic] Diagnostic ${diagnostic._id} already acknowledged or applied.`
          );
        }
      } catch (err) {
        console.error("[PriceDiagnostic] Auto-apply timeout error:", err);
      }
    }, 9 * 60 * 1000);
  } catch (err) {
    console.error("autoDiagnostic error:", err);
  }
};

// ── Resolve Diagnostic (re-check after fix) ──────────────────────────────────

const resolveDiagnostic = async (req, res) => {
  try {
    const { diagnosticId } = req.body;
    if (!diagnosticId) {
      return res
        .status(400)
        .json({ success: false, message: "diagnosticId is required." });
    }

    const diagnostic = await PriceDiagnostic.findById(diagnosticId);
    if (!diagnostic) {
      return res
        .status(404)
        .json({ success: false, message: "Diagnostic not found." });
    }

    // Re-check remaining pending issues
    const remaining = await findUnsetPrices();
    const pendingIds = remaining.map((r) => r.productId.toString());

    let allFixed = true;
    for (const issue of diagnostic.issues) {
      if (issue.status === "pending") {
        if (!pendingIds.includes(issue.productId.toString())) {
          issue.status = "fixed";
          diagnostic.fixedCount = (diagnostic.fixedCount || 0) + 1;
        } else {
          allFixed = false;
        }
      }
    }

    diagnostic.status = allFixed ? "resolved" : "pending";
    diagnostic.completedAt = allFixed ? new Date() : null;
    await diagnostic.save();

    return res.status(200).json({
      success: true,
      message: allFixed
        ? "All issues resolved!"
        : `${remaining.length} issue(s) still pending.`,
      diagnostic,
      remainingIssues: allFixed ? 0 : remaining.length,
    });
  } catch (err) {
    console.error("resolveDiagnostic error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to resolve diagnostic." });
  }
};

module.exports = {
  runDiagnostic,
  getLatestDiagnostic,
  setProductPrice,
  confirmDiagnostic,
  autoDiagnostic,
  resolveDiagnostic,
};
