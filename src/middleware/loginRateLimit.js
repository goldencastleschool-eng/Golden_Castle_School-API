const { createRateLimit } = require("./rateLimitMiddleware");

const loginRateLimit = createRateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  prefix: "login",
  message: "Too many login attempts. Please try again later."
});

module.exports = loginRateLimit;
