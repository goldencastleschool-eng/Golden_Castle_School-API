const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const app = require("../src/app");

describe("API health and platform checks", () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves a liveness endpoint for load balancers", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });

  it("serves a readiness endpoint with dependency status", async () => {
    const response = await fetch(`${baseUrl}/readyz`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.status, "degraded");
    assert.equal(body.mongo.ready, false);
    assert.ok(body.redis.mode);
  });

  it("allows configured browser origins", async () => {
    const response = await fetch(`${baseUrl}/healthz`, {
      headers: {
        Origin: "http://localhost:5173"
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  });
});
