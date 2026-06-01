const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const loginRateLimit = (req, res, next) => {
  const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const record = attempts.get(key) || {
    count: 0,
    resetAt: now + WINDOW_MS
  };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  attempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).json({
      message: "Too many login attempts. Please try again later."
    });
  }

  return next();
};

module.exports = loginRateLimit;
