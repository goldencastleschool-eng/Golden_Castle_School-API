const express = require("express");

const {
  getExecutiveReportOverview
} = require("../controllers/reportController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/overview",
  protect,
  authorizeRoles("admin", "principal", "chairman"),
  getExecutiveReportOverview
);

module.exports = router;
