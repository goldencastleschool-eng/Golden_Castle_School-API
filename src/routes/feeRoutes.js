const express = require("express");

const router = express.Router();

const {
  getFees,
  getMyFees,
  createFee,
  createBatchFees,
  updateFee,
  deleteFee
} = require("../controllers/feeController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");

router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

router.get("/", protect, authorizeRoles("admin", "bursar"), getFees);

router.get("/me", protect, authorizeRoles("student"), getMyFees);

router.post("/", protect, authorizeRoles("admin", "bursar"), createFee);

router.post("/batch", protect, authorizeRoles("admin", "bursar"), createBatchFees);

router.put("/:id", protect, authorizeRoles("admin", "bursar"), updateFee);

router.delete("/:id", protect, authorizeRoles("admin"), deleteFee);

module.exports = router;
