const express = require("express");

const router = express.Router();

const {
  getFees,
  getMyFees,
  createFee,
  updateFee,
  deleteFee
} = require("../controllers/feeController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, authorizeRoles("admin"), getFees);

router.get("/me", protect, authorizeRoles("student"), getMyFees);

router.post("/", protect, authorizeRoles("admin"), createFee);

router.put("/:id", protect, authorizeRoles("admin"), updateFee);

router.delete("/:id", protect, authorizeRoles("admin"), deleteFee);

module.exports = router;
