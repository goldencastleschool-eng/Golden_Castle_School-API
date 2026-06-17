const redisStore = require("../utils/upstashRedis");

const defaultKeyGenerator = (req) =>
  req.ip ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  "unknown";

const createRateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  prefix = "rate-limit",
  message = "Too many requests. Please try again later.",
  keyGenerator = defaultKeyGenerator
} = {}) => {
  const ttlSeconds = Math.ceil(windowMs / 1000);

  return async (req, res, next) => {
    try {
      const rawKey = keyGenerator(req);
      const key = `${prefix}:${rawKey}`;
      const count = await redisStore.incrementWithTtl(key, ttlSeconds);
      const remaining = Math.max(max - count, 0);

      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", remaining);
      res.setHeader("RateLimit-Reset", ttlSeconds);

      if (count > max) {
        res.setHeader("Retry-After", ttlSeconds);

        return res.status(429).json({
          message
        });
      }

      return next();
    } catch (error) {
      return next();
    }
  };
};

module.exports = {
  createRateLimit
};
