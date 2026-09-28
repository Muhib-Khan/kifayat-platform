const Joi = require("joi");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Session = require("../models/Session");
const BlockedUser = require("../models/BlockedUser");
const DeletedUser = require("../models/DeletedUser");
const OrderHistory = require("../models/OrderHistory");
const { verifyFirebaseToken } = require("../config/firebaseAdmin");
const { generateToken, verifyToken } = require("../utils/jwt");
const { setAuthCookie, clearAuthCookie } = require("../utils/cookies");
const {
  generateOTP,
  hashOTP,
  safeEqual,
  getOTPExpiry,
  isOTPExpired,
  storeOTP,
  findOTP,
  consumeOTP,
} = require("../utils/otp");
const { sendOTPEmail } = require("../utils/email");
const { recordLogin } = require("../utils/loginLogger");
const { logActivity, ACTIONS } = require("../utils/activityLogger");

// ---------------------------------------------------------------------------
// Admin email list — role is assigned based on this list at every login/signup.
// Add/remove emails in .env (ADMIN_EMAILS=a@b.com,c@d.com) without touching code.
// ---------------------------------------------------------------------------
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const SELLER_EMAIL = "faiz@kifayat.co";
const getRoleForEmail = (email) => {
  const normalized = email.toLowerCase();
  if (ADMIN_EMAILS.includes(normalized)) return "admin";
  if (normalized === SELLER_EMAIL) return "seller";
  return "user";
};

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required().messages({
    "any.required": "Name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  email: Joi.string().email().lowercase().required().messages({
    "any.required": "Email is required",
    "string.email": "Please enter a valid email address",
  }),
  password: Joi.string().min(8).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 8 characters",
  }),
  gender: Joi.string()
    .valid("Male", "Female", "Other", "Prefer not to say")
    .required()
    .messages({ "any.required": "Gender is required" }),
});

const verifyOTPSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    "string.length": "Code must be 6 digits",
    "string.pattern.base": "Code must contain only numbers",
  }),
});

const resendOTPSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string()
    .required()
    .messages({ "any.required": "Password is required" }),
});

const googleSchema = Joi.object({
  idToken: Joi.string()
    .required()
    .messages({ "any.required": "Firebase token is required" }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const issueSession = async (req, res, user, authProvider) => {
  console.log("🔑 Issuing new session for user:", user.email);
  // Re-evaluate role on every session issue so ADDING an admin email in .env
  // takes effect on next login. Only promote — never demote — otherwise a
  // manually-promoted admin (User Management) is silently reverted to "user"
  // on their next login.
  const roleForEmail = getRoleForEmail(user.email);
  if (user.role !== roleForEmail && (roleForEmail === "admin" || roleForEmail === "seller")) {
    user.role = roleForEmail;
    if (roleForEmail === "seller") {
      user.storeName = "Faiz's Store";
      user.storeSlug = "faizs-store";
    }
    await user.save();
  }
  const token = generateToken(user);
  console.log("🔑 Generated token:", token.substring(0, 20) + "...");
  
  // Calculate expiration date (30 days from now)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  // Create new session in DB
  const session = await Session.create({
    user: user._id,
    token,
    userAgent: req.get("user-agent") || "",
    ipAddress: req.ip || req.connection.remoteAddress || "",
    expiresAt,
  });
  console.log("🔑 Session created in DB:", session._id);
  
  await recordLogin(req, user, authProvider);
  setAuthCookie(res, token);
  console.log("🔑 Auth cookie set!");

  // Log admin login activity
  if (user.role === "admin") {
    await logActivity({
      user,
      action: ACTIONS.LOGIN,
      description: `Admin logged in via ${authProvider}`,
      req,
      metadata: { authProvider },
    });
  }

  return res.status(200).json({
    success: true,
    message: "Authentication successful",
    user: user.toSafeObject(),
  });
};

const firebaseErrorResponse = (res, error) => {
  const code = error.code || "";
  console.error(
    `[Firebase Auth] code=${code || "(none)"} message=${error.message}`,
  );
  if (code === "auth/id-token-expired") {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please sign in again.",
    });
  }
  if (
    [
      "auth/id-token-revoked",
      "auth/argument-error",
      "auth/invalid-id-token",
    ].includes(code)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token. Please sign in again.",
    });
  }
  if (code === "auth/user-disabled") {
    return res
      .status(403)
      .json({ success: false, message: "This account has been disabled." });
  }
  return res.status(401).json({
    success: false,
    message: "Authentication failed. Please sign in again.",
  });
};

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register
 * Creates an unverified account and emails a 6-digit OTP.
 * No Firebase involved.
 */
const register = async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  const { name, email, password, gender } = value;

  try {
    // Prevent blocked users from registering
    const blocked = await BlockedUser.findOne({ email }).lean();
    if (blocked) {
      return res.status(403).json({
        success: false,
        banned: true,
        message: blocked.message || "Your account has been blocked. You cannot register with this email.",
      });
    }

    const existing = await User.findOne({ email });

    if (existing && existing.isVerified) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please log in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    const otpExpiry = getOTPExpiry();

    if (existing && !existing.isVerified) {
      // Re-use existing unverified slot — update credentials + fresh OTP
      existing.name = name;
      existing.password = hashedPassword;
      existing.gender = gender;
      existing.otp = hashedOTP;
      existing.otpExpiry = otpExpiry;
      await existing.save();
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        gender,
        authProvider: "email",
        isVerified: false,
        otp: hashedOTP,
        otpExpiry,
      });
    }

    await sendOTPEmail(email, name, otp);

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email. Please check your inbox.",
    });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered." });
    }
    console.error("Register error:", err);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifies the OTP, marks the account verified, issues a JWT session.
 */
const verifyOTP = async (req, res) => {
  const { error, value } = verifyOTPSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  const { email, otp } = value;

  try {
    const user = await User.findOne({ email, authProvider: "email" });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found. Please sign up.",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please log in.",
      });
    }

    if (isOTPExpired(user.otpExpiry)) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: "Verification code has expired. Please request a new one.",
      });
    }

    if (!safeEqual(user.otp, hashOTP(otp))) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please try again.",
      });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return issueSession(req, res, user, "email");
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
};

/**
 * POST /api/auth/resend-otp
 * Generates a new OTP and re-sends the email.
 */
const resendOTP = async (req, res) => {
  const { error, value } = resendOTPSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  const { email } = value;

  try {
    const user = await User.findOne({ email, authProvider: "email" });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found. Please sign up.",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please log in.",
      });
    }

    const otp = generateOTP();
    user.otp = hashOTP(otp);
    user.otpExpiry = getOTPExpiry();
    await user.save();

    await sendOTPEmail(email, user.name, otp);

    return res.status(200).json({
      success: true,
      message: "New verification code sent to your email.",
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to resend code. Please try again.",
    });
  }
};

/**
 * POST /api/auth/login
 * Email + password login against MongoDB SignupUsers collection. No Firebase.
 */
const login = async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  const { email, password } = value;

  try {
    // Check if blocked
    const blocked = await BlockedUser.findOne({ email }).lean();
    if (blocked) {
      return res.status(403).json({
        success: false,
        banned: true,
        message: blocked.message || "Your account has been blocked.",
      });
    }

    // Check if deleted
    const deleted = await DeletedUser.findOne({ email }).lean();
    if (deleted) {
      return res.status(403).json({
        success: false,
        banned: true,
        message: deleted.message || "Your account has been deleted.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    if (user.authProvider === "google") {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email,
        message:
          "Please verify your email first. Check your inbox for the verification code.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    return issueSession(req, res, user, "email");
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Login failed. Please try again." });
  }
};

/**
 * POST /api/auth/google
 * Firebase ID token verified → upsert user in SignupUsers → JWT session.
 */
const googleAuth = async (req, res) => {
  const { error, value } = googleSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  const { idToken } = value;

  try {
    let decoded;
    try {
      decoded = await verifyFirebaseToken(idToken);
    } catch (firebaseError) {
      return firebaseErrorResponse(res, firebaseError);
    }

    const { uid, email, name: displayName } = decoded;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "No email found in Google account." });
    }

    const normalizedEmail = email.toLowerCase();

    // Check if blocked
    const blocked = await BlockedUser.findOne({ email: normalizedEmail }).lean();
    if (blocked) {
      return res.status(403).json({
        success: false,
        banned: true,
        message: blocked.message || "Your account has been blocked.",
      });
    }

    // If an email-password account already uses this address, upgrade it to
    // Google auth so the user can sign in with Google and keep their data.
    const emailUser = await User.findOne({
      email: normalizedEmail,
      authProvider: "email",
    });
    if (emailUser) {
      emailUser.authProvider = "google";
      emailUser.firebaseUID = uid;
      emailUser.isVerified = true;
      emailUser.name = displayName || emailUser.name;
      await emailUser.save();
      return issueSession(req, res, emailUser, "google");
    }

    let user = await User.findOne({
      email: normalizedEmail,
      authProvider: "google",
    });

    if (user) {
      user.name = displayName || user.name;
      user.firebaseUID = uid;
      user.isVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: displayName || "User",
        email: normalizedEmail,
        gender: "Prefer not to say",
        authProvider: "google",
        firebaseUID: uid,
        isVerified: true,
      });
    }

    return issueSession(req, res, user, "google");
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(500).json({
      success: false,
      message: "Google authentication failed. Please try again.",
    });
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const token = req.cookies?.kifayat_token;
    let loggedOutUser = null;
    
    if (token) {
      try {
        const decoded = verifyToken(token);
        loggedOutUser = await User.findById(decoded.userId);
        const now = new Date();
        const session = await Session.findOne({ token, user: decoded.userId });
        if (session) {
          session.loggedOutAt = now;
          if (session.lastActiveAt) {
            session.durationMs = session.lastActiveAt.getTime() - session.createdAt.getTime();
          } else {
            session.durationMs = now.getTime() - session.createdAt.getTime();
          }
          await session.save();
        }
      } catch {
        // Token may be expired — still clear cookie
      }
    }
    
    // Log admin logout activity
    if (loggedOutUser && loggedOutUser.role === "admin") {
      await logActivity({
        user: loggedOutUser,
        action: ACTIONS.LOGOUT,
        description: "Admin logged out",
        req,
      });
    }
    
    clearAuthCookie(res);
    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout error:", err);
    clearAuthCookie(res);
    return res.status(500).json({ success: false, message: "Logout failed." });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const user = req.user;

    // Logged-out (or invalid session) — return a clean 200 so the browser
    // does not log a failed request. The frontend treats user:null as
    // "not signed in".
    if (!user) {
      return res.status(200).json({ success: true, user: null });
    }

    const { getTier } = require("../config/tiers");

    // Auto-assign isVerifiedCustomer
    if (!user.isVerifiedCustomer) {
      const orderCount = await OrderHistory.countDocuments({ "user.userId": user._id });
      if (orderCount >= 15) {
        user.isVerifiedCustomer = true;
        await user.save();
      }
    }

    // Refresh durable purchase counts so the frontend's first-purchase perk
    // (30% off via priceMultiplier) is accurate for every user, including
    // those with a manually assigned tier.
    const [orderCount, spent] = await Promise.all([
      OrderHistory.countDocuments({ "user.userId": user._id }),
      OrderHistory.aggregate([
        { $match: { "user.userId": user._id } },
        { $group: { _id: null, totalSpent: { $sum: { $ifNull: ["$sellPrice", 0] } } } },
      ]),
    ]);
    const totalSpent = spent[0]?.totalSpent ?? 0;

    user.totalOrdersCount = orderCount;
    user.totalSpentAmount = totalSpent;

    // Auto-assign tier (unless manually set)
    if (!user.tierAssignedManually) {
      const newTier = getTier(orderCount, totalSpent);
      if (user.tier !== newTier) {
        user.tier = newTier;
        await user.save();
      }
    }

    // Re-evaluate role from ADMIN_EMAILS so admin access survives refreshes
    // even if the persisted role is stale (e.g. accounts created as "user").
    // Only promote — never demote — so a manually-promoted admin role
    // (set from User Management) is not reverted by a /auth/me call.
    const roleForEmail = getRoleForEmail(user.email);
    if (user.role !== roleForEmail && (roleForEmail === "admin" || roleForEmail === "seller")) {
      user.role = roleForEmail;
      if (roleForEmail === "seller") {
        user.storeName = "Faiz's Store";
        user.storeSlug = "faizs-store";
      }
      await user.save();
    }

    return res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch profile." });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/auth/profile
// Updates name, gender immediately. For email change, sends OTP to new email.
// Body: { name?, gender?, newEmail? }
// ---------------------------------------------------------------------------
const updateProfile = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(80),
    gender: Joi.string().valid("Male", "Female", "Other", "Prefer not to say"),
    phone: Joi.string().trim().max(20).allow("", null),
    newEmail: Joi.string().email().lowercase(),
    avatar: Joi.string().trim().uri().allow("", null),
    dateOfBirth: Joi.date().iso().allow(null),
  }).min(1);

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const changes = [];
    if (value.name) {
      changes.push(`name: "${user.name}" → "${value.name}"`);
      user.name = value.name;
    }
    if (value.gender) {
      changes.push(`gender: "${user.gender}" → "${value.gender}"`);
      user.gender = value.gender;
    }
    if (value.phone !== undefined) {
      changes.push(`phone: "${user.phone}" → "${value.phone}"`);
      user.phone = value.phone;
    }
    if (value.avatar !== undefined) {
      changes.push(`avatar updated`);
      user.avatar = value.avatar;
    }
    if (value.dateOfBirth !== undefined) {
      changes.push(`dateOfBirth updated`);
      user.dateOfBirth = value.dateOfBirth;
    }

    // If changing email, send OTP to new email and store pendingEmail
    if (value.newEmail && value.newEmail !== user.email) {
      const existing = await User.findOne({ email: value.newEmail });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This email is already in use.",
        });
      }

      const otp = generateOTP();
      user.pendingEmail = value.newEmail;
      user.pendingEmailOTP = hashOTP(otp);
      user.pendingEmailOTPExpiry = getOTPExpiry();
      await user.save();

      try {
        await sendOTPEmail(value.newEmail, user.name, otp);
      } catch {
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email.",
          requiresEmailOTP: true,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile updated. Verification code sent to new email.",
        user: user.toSafeObject(),
        requiresEmailOTP: true,
      });
    }

    await user.save();

    if (changes.length > 0) {
      await logActivity({
        user,
        action: ACTIONS.PROFILE_UPDATED,
        description: `Updated profile: ${changes.join("; ")}`,
        req,
        targetUser: user._id,
        metadata: { changes },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email-update
// Verifies OTP sent to new email and applies the email change.
// Body: { otp }
// ---------------------------------------------------------------------------
const verifyEmailUpdate = async (req, res) => {
  const schema = Joi.object({
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: "Invalid verification code." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({
        success: false,
        message: "No email change requested.",
      });
    }

    if (isOTPExpired(user.pendingEmailOTPExpiry)) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: "Verification code expired. Please request again.",
      });
    }

    if (!safeEqual(hashOTP(value.otp), user.pendingEmailOTP)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmail;
    user.email = newEmail;
    user.pendingEmail = null;
    user.pendingEmailOTP = null;
    user.pendingEmailOTPExpiry = null;
    await user.save();

    await logActivity({
      user,
      action: ACTIONS.EMAIL_CHANGED,
      description: `Changed email from "${oldEmail}" to "${newEmail}"`,
      req,
      targetUser: user._id,
      metadata: { oldEmail, newEmail },
    });

    // Re-issue session with new email
    const token = generateToken(user);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await Session.create({
      user: user._id,
      token,
      userAgent: req.get("user-agent") || "",
      ipAddress: req.ip || "",
      expiresAt,
    });
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Email updated successfully.",
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("Verify email update error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify email update." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/resend-email-update-otp
// Resends the email change OTP
// ---------------------------------------------------------------------------
const resendEmailUpdateOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.pendingEmail) {
      return res.status(400).json({ success: false, message: "No email change requested." });
    }

    const otp = generateOTP();
    user.pendingEmailOTP = hashOTP(otp);
    user.pendingEmailOTPExpiry = getOTPExpiry();
    await user.save();

    await sendOTPEmail(user.pendingEmail, user.name, otp);

    return res.status(200).json({
      success: true,
      message: "New verification code sent to your new email.",
    });
  } catch (err) {
    console.error("Resend email update OTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to resend code." });
  }
};

// Delete-account OTPs are stored in MongoDB (see utils/otp.js storeOTP/findOTP/consumeOTP).

// ---------------------------------------------------------------------------
// POST /api/auth/send-delete-otp
// Sends OTP to current email for delete confirmation (email auth only).
// ---------------------------------------------------------------------------
const sendDeleteOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.authProvider !== "email") {
      return res.status(400).json({
        success: false,
        message: "Google accounts can be deleted directly without verification.",
        directDelete: true,
      });
    }

    const otp = generateOTP();
    const hashedOtp = hashOTP(otp);
    const expiry = getOTPExpiry();
    await storeOTP(`delete-account:${user._id.toString()}`, "delete-account", hashedOtp, expiry);

    try {
      await sendOTPEmail(user.email, user.name, otp);
    } catch {
      await consumeOTP(`delete-account:${user._id.toString()}`);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (err) {
    console.error("Send delete OTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to send code." });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/auth/account
// Self-delete account — removes user, sessions, login history.
// For email auth: requires ?otp=XXXXXX query param for verification.
// For Google auth: no OTP needed, deletes directly.
// ---------------------------------------------------------------------------
const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // For email auth users, verify OTP first
    if (user.authProvider === "email") {
      const { otp } = req.query;
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: "Verification code is required to delete account.",
        });
      }

      const storeKey = `delete-account:${user._id.toString()}`;
      const storedData = await findOTP(storeKey);
      if (!storedData) {
        return res.status(400).json({
          success: false,
          message: "No verification code found. Please request a new one.",
        });
      }

      if (isOTPExpired(storedData.expiry)) {
        await consumeOTP(storeKey);
        return res.status(400).json({
          success: false,
          expired: true,
          message: "Verification code expired. Please request a new one.",
        });
      }

      if (!safeEqual(hashOTP(otp), storedData.hashedOtp)) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code.",
        });
      }

      await consumeOTP(storeKey);
    }

    // Delete Firebase user if Google account
    if (user.firebaseUID) {
      try {
        const { getAuth } = require("firebase-admin/auth");
        await getAuth().deleteUser(user.firebaseUID);
      } catch {
        // Firebase user may not exist — ignore
      }
    }

    const deletedUserEmail = user.email;
    const deletedUserName = user.name;

    await Session.deleteMany({ user: user._id });
    const LoginHistory = require("../models/LoginHistory");
    await LoginHistory.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    clearAuthCookie(res);

    await logActivity({
      user: null,
      action: ACTIONS.ACCOUNT_DELETED,
      description: `User "${deletedUserName}" (${deletedUserEmail}) deleted their own account`,
      req,
      metadata: { deletedEmail: deletedUserEmail, deletedName: deletedUserName },
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully.",
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete account." });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/auth/password
// Changes password with OTP verification sent to current email.
// Body: { currentPassword, newPassword }
// ---------------------------------------------------------------------------
const changePassword = async (req, res) => {
  const schema = Joi.object({
    currentPassword: Joi.string().required().messages({ "any.required": "Current password is required" }),
    newPassword: Joi.string().min(8).required().messages({
      "any.required": "New password is required",
      "string.min": "New password must be at least 8 characters",
    }),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.authProvider !== "email") {
      return res.status(400).json({
        success: false,
        message: "Google accounts use Google sign-in. Cannot change password here.",
      });
    }

    const match = await bcrypt.compare(value.currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    // Send OTP to current email for verification
    const otp = generateOTP();
    user.pendingPasswordOTP = hashOTP(otp);
    user.pendingPasswordOTPExpiry = getOTPExpiry();
    user.pendingNewPassword = await bcrypt.hash(value.newPassword, 12);
    await user.save();

    try {
      await sendOTPEmail(user.email, user.name, otp);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email. Use it to confirm the password change.",
      requiresPasswordOTP: true,
    });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ success: false, message: "Failed to change password." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/verify-password-update
// Verifies OTP and applies the pending password change.
// Body: { otp }
// ---------------------------------------------------------------------------
const verifyPasswordUpdate = async (req, res) => {
  const schema = Joi.object({
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: "Invalid verification code." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.pendingNewPassword) {
      return res.status(400).json({
        success: false,
        message: "No password change requested.",
      });
    }

    if (isOTPExpired(user.pendingPasswordOTPExpiry)) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: "Verification code expired. Please request again.",
      });
    }

    if (!safeEqual(hashOTP(value.otp), user.pendingPasswordOTP)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    user.password = user.pendingNewPassword;
    user.pendingNewPassword = null;
    user.pendingPasswordOTP = null;
    user.pendingPasswordOTPExpiry = null;
    await user.save();

    await logActivity({
      user,
      action: ACTIONS.PASSWORD_CHANGED,
      description: "Changed account password",
      req,
      targetUser: user._id,
    });

    // Re-issue session
    const token = generateToken(user);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await Session.create({
      user: user._id,
      token,
      userAgent: req.get("user-agent") || "",
      ipAddress: req.ip || "",
      expiresAt,
    });
    setAuthCookie(res, token);

    // Invalidate ALL other sessions after password change
    await Session.deleteMany({ user: user._id, token: { $ne: token } });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("Verify password update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update password." });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/auth/order-con-email
// Sets or changes the order confirmation email.
// If different from login email, sends OTP to verify it.
// Body: { email }
// ---------------------------------------------------------------------------
const updateOrderConEmail = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: "Valid email is required." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { email } = value;

    // If same as already verified orderConEmail, just return success
    if (user.orderConEmailVerified && user.orderConEmail === email) {
      return res.status(200).json({
        success: true,
        message: "Order confirmation email already set.",
        verified: true,
      });
    }

    // If the email matches the user's login email and they are verified, auto-verify
    if (email === user.email && user.isVerified) {
      user.orderConEmail = email;
      user.orderConEmailVerified = true;
      user.pendingOrderConEmail = null;
      user.pendingOrderConEmailOTP = null;
      user.pendingOrderConEmailOTPExpiry = null;
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Order confirmation email set successfully.",
        verified: true,
      });
    }

    // Otherwise, send OTP to the new email
    const otp = generateOTP();
    user.pendingOrderConEmail = email;
    user.pendingOrderConEmailOTP = hashOTP(otp);
    user.pendingOrderConEmailOTPExpiry = getOTPExpiry();
    await user.save();

    try {
      await sendOTPEmail(email, user.name, otp);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email.",
      requiresOTP: true,
    });
  } catch (err) {
    console.error("Update orderConEmail error:", err);
    return res.status(500).json({ success: false, message: "Failed to update order confirmation email." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/verify-order-con-email
// Verifies OTP for order confirmation email.
// Body: { otp }
// ---------------------------------------------------------------------------
const verifyOrderConEmail = async (req, res) => {
  const schema = Joi.object({
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: "Invalid verification code." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.pendingOrderConEmail) {
      return res.status(400).json({
        success: false,
        message: "No order confirmation email change requested.",
      });
    }

    if (isOTPExpired(user.pendingOrderConEmailOTPExpiry)) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: "Verification code expired. Please request again.",
      });
    }

    if (!safeEqual(hashOTP(value.otp), user.pendingOrderConEmailOTP)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    const prevOrderConEmail = user.orderConEmail;
    user.orderConEmail = user.pendingOrderConEmail;
    user.orderConEmailVerified = true;
    user.pendingOrderConEmail = null;
    user.pendingOrderConEmailOTP = null;
    user.pendingOrderConEmailOTPExpiry = null;
    await user.save();

    await logActivity({
      user,
      action: ACTIONS.ORDER_CON_EMAIL_CHANGED,
      description: `Changed order confirmation email to "${user.orderConEmail}"`,
      req,
      targetUser: user._id,
      metadata: { previous: prevOrderConEmail, newEmail: user.orderConEmail },
    });

    return res.status(200).json({
      success: true,
      message: "Order confirmation email verified successfully.",
      verified: true,
    });
  } catch (err) {
    console.error("Verify orderConEmail error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify order confirmation email." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/resend-order-con-email-otp
// Resends OTP for order confirmation email verification.
// ---------------------------------------------------------------------------
const resendOrderConEmailOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.pendingOrderConEmail) {
      return res.status(400).json({ success: false, message: "No pending email change." });
    }

    const otp = generateOTP();
    user.pendingOrderConEmailOTP = hashOTP(otp);
    user.pendingOrderConEmailOTPExpiry = getOTPExpiry();
    await user.save();

    await sendOTPEmail(user.pendingOrderConEmail, user.name, otp);

    return res.status(200).json({
      success: true,
      message: "New verification code sent.",
    });
  } catch (err) {
    console.error("Resend orderConEmail OTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to resend code." });
  }
};

// Shipment-email OTPs are stored in MongoDB (see utils/otp.js storeOTP/findOTP/consumeOTP).

// ---------------------------------------------------------------------------
// GET /api/auth/shipment-emails
// Returns the user's verified shipment emails (login email always included).
// ---------------------------------------------------------------------------
const getShipmentEmails = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const extraEmails = (user.shipmentEmails || []).filter(
      (e) => e.toLowerCase() !== user.email.toLowerCase()
    );
    return res.status(200).json({
      success: true,
      loginEmail: user.email,
      shipmentEmails: extraEmails,
    });
  } catch (err) {
    console.error("getShipmentEmails error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch shipment emails." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/shipment-emails/send-otp
// Sends OTP to a new email for verification.
// Body: { email }
// ---------------------------------------------------------------------------
const sendShipmentEmailOTP = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: "Valid email is required." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { email } = value;

    // Check if already in shipment list or is login email
    const allEmails = [user.email, ...(user.shipmentEmails || [])];
    if (allEmails.some((e) => e.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ success: false, message: "This email is already verified." });
    }

    const otp = generateOTP();
    const hashedOtp = hashOTP(otp);
    const expiry = getOTPExpiry();
    const storeKey = `shipment-email:${user._id.toString()}-${email}`;
    await storeOTP(storeKey, "shipment-email", hashedOtp, expiry);

    try {
      await sendOTPEmail(email, user.name, otp);
    } catch {
      await consumeOTP(storeKey);
      return res.status(500).json({ success: false, message: "Failed to send verification email." });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email.",
      requiresOTP: true,
    });
  } catch (err) {
    console.error("sendShipmentEmailOTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to send verification code." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/shipment-emails/verify-otp
// Verifies OTP and adds email to user's shipmentEmails list.
// Body: { email, otp }
// ---------------------------------------------------------------------------
const verifyShipmentEmailOTP = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: "Invalid request." });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { email, otp } = value;
    const storeKey = `shipment-email:${user._id.toString()}-${email}`;
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

    await consumeOTP(storeKey);

    // Add to shipmentEmails if not already present
    const normalized = email.toLowerCase();
    const existing = (user.shipmentEmails || []).map((e) => e.toLowerCase());
    if (!existing.includes(normalized) && normalized !== user.email.toLowerCase()) {
      user.shipmentEmails.push(normalized);
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      verified: true,
    });
  } catch (err) {
    console.error("verifyShipmentEmailOTP error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify email." });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/auth/shipment-emails/:email
// Removes a shipment email from the user's list.
// ---------------------------------------------------------------------------
const removeShipmentEmail = async (req, res) => {
  try {
    const emailToRemove = decodeURIComponent(req.params.email).toLowerCase();
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (emailToRemove === user.email.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Cannot remove your primary login email." });
    }

    user.shipmentEmails = (user.shipmentEmails || []).filter(
      (e) => e.toLowerCase() !== emailToRemove
    );
    await user.save();

    return res.status(200).json({ success: true, message: "Email removed." });
  } catch (err) {
    console.error("removeShipmentEmail error:", err);
    return res.status(500).json({ success: false, message: "Failed to remove email." });
  }
};

const heartbeat = async (req, res) => {
  try {
    const token = req.cookies?.kifayat_token;
    if (!token) return res.status(200).json({ success: true });
    const decoded = verifyToken(token);
    await Session.updateOne(
      { token, user: decoded.userId },
      { $set: { lastActiveAt: new Date() } }
    );
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// Sends OTP to user's email for password reset (unauthenticated).
// Body: { email }
// ---------------------------------------------------------------------------
const forgotPassword = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      "any.required": "Email is required",
      "string.email": "Please enter a valid email address",
    }),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  try {
    const user = await User.findOne({ email: value.email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a reset code has been sent.",
      });
    }

    if (user.authProvider !== "email") {
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a reset code has been sent.",
      });
    }

    const otp = generateOTP();
    user.pendingPasswordOTP = hashOTP(otp);
    user.pendingPasswordOTPExpiry = getOTPExpiry();
    await user.save();

    try {
      await sendOTPEmail(user.email, user.name, otp);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset code sent to your email.",
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ success: false, message: "Failed to process request." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// Resets password using OTP (unauthenticated).
// Body: { email, otp, newPassword }
// ---------------------------------------------------------------------------
const resetPassword = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      "string.length": "Code must be 6 digits",
      "string.pattern.base": "Code must contain only numbers",
    }),
    newPassword: Joi.string().min(8).required().messages({
      "any.required": "New password is required",
      "string.min": "New password must be at least 8 characters",
    }),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join("; "),
    });
  }

  try {
    const user = await User.findOne({ email: value.email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset code." });
    }

    if (!user.pendingPasswordOTP || !user.pendingPasswordOTPExpiry) {
      return res.status(400).json({
        success: false,
        message: "No password reset requested. Please request a new code.",
      });
    }

    if (isOTPExpired(user.pendingPasswordOTPExpiry)) {
      user.pendingPasswordOTP = null;
      user.pendingPasswordOTPExpiry = null;
      await user.save();
      return res.status(400).json({
        success: false,
        expired: true,
        message: "Reset code expired. Please request a new one.",
      });
    }

    if (!safeEqual(hashOTP(value.otp), user.pendingPasswordOTP)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code.",
      });
    }

    user.password = await bcrypt.hash(value.newPassword, 12);
    user.pendingNewPassword = null;
    user.pendingPasswordOTP = null;
    user.pendingPasswordOTPExpiry = null;
    await user.save();

    // Invalidate all existing sessions so stolen cookies no longer work
    const Session = require("../models/Session");
    await Session.deleteMany({ user: user._id });

    await logActivity({
      user,
      action: ACTIONS.PASSWORD_CHANGED,
      description: "Password reset via forgot-password flow",
      req,
      targetUser: user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ success: false, message: "Failed to reset password." });
  }
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  googleAuth,
  logout,
  heartbeat,
  getMe,
  updateProfile,
  verifyEmailUpdate,
  resendEmailUpdateOTP,
  deleteAccount,
  sendDeleteOTP,
  changePassword,
  verifyPasswordUpdate,
  forgotPassword,
  resetPassword,
  updateOrderConEmail,
  verifyOrderConEmail,
  resendOrderConEmailOTP,
  getShipmentEmails,
  sendShipmentEmailOTP,
  verifyShipmentEmailOTP,
  removeShipmentEmail,
};
