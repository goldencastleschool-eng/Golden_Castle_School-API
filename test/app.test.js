const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const app = require("../src/app");
const {
  getStudentEffectiveTermEnrollment
} = require("../src/utils/studentTermEnrollment");
const {
  isFeeExemptCategory
} = require("../src/utils/feeCategories");
const {
  getExpectedFeeSnapshot
} = require("../src/utils/feeCalculation");

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

describe("student fee calculation", () => {
  it("treats scholarship and vip categories as fee-exempt", () => {
    assert.equal(isFeeExemptCategory("vip"), true);
    assert.equal(isFeeExemptCategory("scholarship"), true);
    assert.equal(isFeeExemptCategory("discounted"), false);
  });

  it("applies student-specific discounts to the base class fee", () => {
    const feeStructure = {
      amount: 46000
    };

    const studentA = getExpectedFeeSnapshot({
      feeStructure,
      enrollment: {
        fee_category: "discounted",
        discount_amount: 10000
      }
    });
    const studentB = getExpectedFeeSnapshot({
      feeStructure,
      enrollment: {
        fee_category: "discounted",
        discount_amount: 30000
      }
    });

    assert.equal(studentA.expectedAmount, 36000);
    assert.equal(studentB.expectedAmount, 16000);
  });

  it("caps discounts at the class fee amount", () => {
    const snapshot = getExpectedFeeSnapshot({
      feeStructure: {
        amount: 46000
      },
      enrollment: {
        fee_category: "discounted",
        discount_amount: 80000
      }
    });

    assert.equal(snapshot.expectedAmount, 0);
    assert.equal(snapshot.discountAmount, 46000);
  });
});
