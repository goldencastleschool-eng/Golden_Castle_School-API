const express = require("express");

const router = express.Router();

const {
  getResultAccess,
  updateResultAccess,
  updateCumulativeResultAccess,
  updateBroadsheetAccess,
  updateClassResultAccess
} = require("../controllers/resultAccessController");

const protect = require("../middleware/authMiddleware");

const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, getResultAccess);

router.put(
  "/cumulative",
  protect,
  authorizeRoles("admin"),
  updateCumulativeResultAccess
);

router.put(
  "/broadsheet",
  protect,
  authorizeRoles("admin"),
  updateBroadsheetAccess
);

router.put(
  "/class-result",
  protect,
  authorizeRoles("admin"),
  updateClassResultAccess
);

router.put("/", protect, authorizeRoles("admin"), updateResultAccess);

module.exports = router;
