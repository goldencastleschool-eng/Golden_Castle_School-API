const express = require("express");

const router = express.Router();

const {
  getFeeStructures,
  createFeeStructure,
  upsertBothFeeStructures,
  updateFeeStructure,
  deleteFeeStructure
} = require("../controllers/feeStructureController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, authorizeRoles("admin"), getFeeStructures);

router.post("/", protect, authorizeRoles("admin"), createFeeStructure);

router.put("/bulk", protect, authorizeRoles("admin"), upsertBothFeeStructures);

router.put("/:id", protect, authorizeRoles("admin"), updateFeeStructure);

router.delete("/:id", protect, authorizeRoles("admin"), deleteFeeStructure);

module.exports = router;
