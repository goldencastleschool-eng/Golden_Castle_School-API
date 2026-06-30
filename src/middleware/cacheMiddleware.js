const redisStore = require("../utils/upstashRedis");

// Authenticated dashboard caches must use role/filter-aware keys to avoid sharing data across portals.
const createCache = ({
  ttlSeconds = 60,
  prefix = "cache",
  cacheAuthorized = false,
  keyGenerator = (req) => `${req.method}:${req.originalUrl}`
} = {}) => async (req, res, next) => {
  const hasAuthCookie = req.headers.cookie
    ?.split(";")
    .some((cookiePart) =>
      cookiePart.trim().startsWith(`${process.env.AUTH_COOKIE_NAME || "gcs_auth_token"}=`)
    );

  if (
    req.method !== "GET" ||
    (!cacheAuthorized && (req.headers.authorization || hasAuthCookie))
  ) {
    return next();
  }

  const cacheKey = `${prefix}:${keyGenerator(req)}`;

  try {
    const cached = await redisStore.get(cacheKey);

    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(cached.status).json(cached.body);
    }
  } catch (error) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      redisStore
        .set(
          cacheKey,
          {
            status: res.statusCode,
            body
          },
          ttlSeconds
        )
        .catch(() => {});
    }

    res.setHeader("X-Cache", "MISS");
    return originalJson(body);
  };

  return next();
};

const invalidateCache = (prefixes = []) => async (req, res, next) => {
  if (req.method === "GET") {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      prefixes.forEach((prefix) => {
        redisStore.deleteByPrefix(prefix).catch(() => {});
      });
    }

    return originalJson(body);
  };

  return next();
};

module.exports = {
  createCache,
  invalidateCache
};
