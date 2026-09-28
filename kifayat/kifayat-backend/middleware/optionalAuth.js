const User = require("../models/User");
const Session = require("../models/Session");
const { verifyToken } = require("../utils/jwt");
const { COOKIE_NAME } = require("../utils/cookies");

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return next();

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return next();
    }

    const session = await Session.findOne({ token, user: decoded.userId });
    if (!session) return next();

    const user = await User.findById(decoded.userId);
    if (!user || !user.isVerified) return next();

    req.user = user;
    next();
  } catch {
    next();
  }
};

module.exports = optionalAuth;
