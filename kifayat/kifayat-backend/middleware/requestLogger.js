const crypto = require("crypto");
const { accessLogger } = require("../utils/logger");

const requestLogger = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.set("X-Request-Id", requestId);

  const startedAt = Date.now();
  const start = process.hrtime();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const [sec, ns] = process.hrtime(start);
    const elapsedMs = Math.round(sec * 1000 + ns / 1e6);
    const line = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      elapsedMs,
      ip: req.ip,
      userAgent: (req.headers["user-agent"] || "").slice(0, 120),
    };
    
    // Log based on status code
    if (res.statusCode >= 500) {
      accessLogger.error("HTTP Request", line);
    } else if (res.statusCode >= 400) {
      accessLogger.warn("HTTP Request", line);
    } else {
      accessLogger.info("HTTP Request", line);
    }
  });

  next();
};

module.exports = requestLogger;
