const express = require("express");

const {
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

router.get(
  "/overview",
  protect,
  authorizeRoles("admin", "principal", "chairman"),
  reportOverviewCache,
  getExecutiveReportOverview
);

module.exports = router;
