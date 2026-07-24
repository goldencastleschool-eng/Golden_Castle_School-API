const express = require("express");

const {
  getAdminDashboardSummary,
  getExecutiveReportOverview
} = require("../controllers/reportController");
const protect = require("../middleware/authMiddleware");
const { createCache } = require("../middleware/cacheMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const reportOverviewCache = createCache({
  prefix: "reports:overview",
  ttlSeconds: 180,
  cacheAuthorized: true,
  keyGenerator: (req) => {
    const session = req.query.session || "";
    const term = req.query.term || "";
    const classRecord = req.query.class_record || "";

    return [
      req.user?.role || "unknown",
      session,
      term,
      classRecord
    ].join(":");
  }
});
const adminDashboardCache = createCache({
  prefix: "reports:admin-dashboard",
  ttlSeconds: 120,
  cacheAuthorized: true,
  keyGenerator: (req) => {
    const session = req.query.session || "";
    const term = req.query.term || "";

    return [
      req.user?.role || "unknown",
      session,
      term
    ].join(":");
  }
});

router.get(
  "/overview",
  protect,
  authorizeRoles("admin", "principal", "chairman"),
  reportOverviewCache,
  getExecutiveReportOverview
);

router.get(
  "/admin-dashboard",
  protect,
  authorizeRoles("admin"),
  adminDashboardCache,
  getAdminDashboardSummary
);

module.exports = router;
