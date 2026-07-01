const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const app = require("../src/app");
const {
  getStudentEffectiveTermEnrollment
} = require("../src/utils/studentTermEnrollment");

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

describe("student fee term enrollment", () => {
  it("treats a prior-term new admission as returning in later terms", () => {
    const student = {
      fee_enrollments: [
        {
          session: "2025/2026",
          term: "Second Term",
          fee_category: "new",
          class: "Primary 2"
        }
      ]
    };

    const admissionTermEnrollment = getStudentEffectiveTermEnrollment(
      student,
      "2025/2026",
      "Second Term"
    );
    const laterTermEnrollment = getStudentEffectiveTermEnrollment(
      student,
      "2025/2026",
      "Third Term"
    );

    assert.equal(admissionTermEnrollment.fee_category, "new");
    assert.equal(laterTermEnrollment.fee_category, "returning");
    assert.equal(laterTermEnrollment.class, "Primary 2");
  });

  it("keeps non-admission fee categories active in later terms", () => {
    const student = {
      fee_enrollments: [
        {
          session: "2025/2026",
          term: "First Term",
          fee_category: "vip",
          class: "Primary 4"
        }
      ]
    };

    const laterTermEnrollment = getStudentEffectiveTermEnrollment(
      student,
      "2025/2026",
      "Third Term"
    );

    assert.equal(laterTermEnrollment.fee_category, "vip");
  });
});
