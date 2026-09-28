const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || "30d";

// A random nonce keeps every token unique even when two sessions are issued
// for the same user within the same second (same payload + same iat would
// otherwise produce identical tokens and collide on UserSessions.token).
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      firebaseUID: user.firebaseUID,
      email: user.email,
      nonce: crypto.randomBytes(16).toString("hex"),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
