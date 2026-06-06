const express = require("express");

const router = express.Router();

const {
  getResultAccess,
  updateResultAccess,
  updateCumulativeResultAccess
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

router.put("/", protect, authorizeRoles("admin"), updateResultAccess);

module.exports = router;
