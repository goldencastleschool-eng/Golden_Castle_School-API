const { Redis } = require("@upstash/redis");

const memoryStore = new Map();
let redisClient;

const getRedisConfig = () => {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_DATABASE_URL ||
    process.env.UPSTASH_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_DATABASE_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      "Upstash REST URL must start with https://. Use UPSTASH_REDIS_REST_URL, not the rediss:// database URL."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    token
  };
};

const isConfigured = () => Boolean(getRedisConfig());

const getClient = () => {
  const config = getRedisConfig();

  if (!config) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    url: config.url,
    token: config.token
  });

  return redisClient;
};

const getMemoryValue = (key) => {
  const record = memoryStore.get(key);

  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return record.value;
};

const setMemoryValue = (key, value, ttlSeconds) => {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
};

const get = async (key) => {
  const client = getClient();

  if (client) {
    return client.get(key);
  }

  return getMemoryValue(key);
};

const set = async (key, value, ttlSeconds) => {
  const client = getClient();

  if (client) {
    await client.set(key, value, {
      ex: ttlSeconds
    });
    return;
  }

  setMemoryValue(key, value, ttlSeconds);
};

const incrementWithTtl = async (key, ttlSeconds) => {
  const client = getClient();

  if (client) {
    const count = Number(await client.incr(key));
    await client.expire(key, ttlSeconds);
    return count;
  }

  const current = getMemoryValue(key);
  const count = Number(current || 0) + 1;
  setMemoryValue(key, count, ttlSeconds);
  return count;
};

module.exports = {
  get,
  set,
  incrementWithTtl,
  isConfigured,
  getClient
};
