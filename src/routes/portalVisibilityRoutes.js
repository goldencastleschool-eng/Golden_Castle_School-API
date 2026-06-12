const express = require("express");

const {
  getAdminPortalVisibility
} = require("../controllers/portalVisibilityController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/admin",
  protect,
  authorizeRoles("admin"),
  getAdminPortalVisibility
);

module.exports = router;
