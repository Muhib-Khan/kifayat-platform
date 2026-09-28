const LoginHistory = require("../models/LoginHistory");
const User = require("../models/User");

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
};

const recordLogin = async (req, user, authProvider, success = true) => {
  const now = new Date();

  try {
    await LoginHistory.create({
      userId: user._id,
      email: user.email,
      authProvider,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      success,
      loginAt: now,
    });

    if (success) {
      await User.findByIdAndUpdate(user._id, { lastActiveAt: now });
      user.lastActiveAt = now;
    }
  } catch (err) {
    console.error("Login history record failed:", err.message);
  }
};

const touchLastActive = async (user) => {
  const now = new Date();
  const last = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;

  if (now.getTime() - last < 5 * 60 * 1000) {
    return;
  }

  User.findByIdAndUpdate(user._id, { lastActiveAt: now }).catch(() => {});
  user.lastActiveAt = now;
};

module.exports = { recordLogin, touchLastActive, getClientIp };
