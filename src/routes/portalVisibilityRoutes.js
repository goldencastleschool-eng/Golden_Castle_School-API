const express = require("express");

const {
  getAdminPortalVisibility
} = require("../controllers/portalVisibilityController");
const protect = require("../middleware/authMiddleware");
const { createCache } = require("../middleware/cacheMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const portalVisibilityCache = createCache({
  prefix: "dashboard:portal-visibility",
  ttlSeconds: 120,
  cacheAuthorized: true,
  keyGenerator: (req) => {
    const session = req.query.session || "";
    const term = req.query.term || "";

    return `${req.user?.role || "unknown"}:${session}:${term}`;
  }
});

router.get(
  "/admin",
  protect,
  authorizeRoles("admin"),
  portalVisibilityCache,
  getAdminPortalVisibility
);

module.exports = router;
