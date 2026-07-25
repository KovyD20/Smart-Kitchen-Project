// Per-user rate limiter for the AI endpoints (protects the Gemini quota / budget).
// Keyed by the authenticated uid, so it must run AFTER requireAuth.

const rateLimit = require("express-rate-limit");

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // per user per window
  keyGenerator: (req) => req.user?.uid || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please try again later" },
});

module.exports = { aiLimiter };
