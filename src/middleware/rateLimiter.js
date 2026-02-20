const rateLimit = require("express-rate-limit");
const apiResponse = require("../utils/apiResponse");

// general API rate limit — all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiResponse.error(
      res,
      "Too many requests — please try again later",
      429,
    );
  },
});

// strict limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // only 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiResponse.error(
      res,
      "Too many login attempts — please try again in 15 minutes",
      429,
    );
  },
});

// strict limit for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // only 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiResponse.error(
      res,
      "Too many password reset attempts — please try again in 1 hour",
      429,
    );
  },
});

module.exports = { globalLimiter, authLimiter, passwordResetLimiter };
