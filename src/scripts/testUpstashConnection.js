require("dotenv").config();

const redisStore = require("../utils/upstashRedis");

const run = async () => {
  if (!redisStore.isConfigured()) {
    throw new Error(
      "Upstash is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the backend environment."
    );
  }

  const key = `golden-castle:upstash-test:${Date.now()}`;

  await redisStore.set(key, {
    ok: true,
    checked_at: new Date().toISOString()
  }, 30);

  const value = await redisStore.get(key);

  if (!value?.ok) {
    throw new Error("Upstash write/read test failed.");
  }

  const count = await redisStore.incrementWithTtl(`${key}:rate`, 30);

  if (count !== 1) {
    throw new Error("Upstash increment test failed.");
  }

  console.log("Upstash connection OK");
};

run().catch((error) => {
  console.error(`Upstash connection failed: ${error.message}`);

  if (error.cause?.code) {
    console.error(`Cause: ${error.cause.code}`);
  }

  process.exit(1);
});
