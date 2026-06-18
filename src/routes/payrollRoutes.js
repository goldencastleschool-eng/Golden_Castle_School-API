const express = require("express");

const {
  getLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getStructures,
  createStructure,
  updateStructure,
  deleteStructure,
  getAssignments,
  createAssignments,
  updateAssignment,
  deleteAssignment,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment
} = require("../controllers/payrollController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin"));
router.use(invalidateCache(["reports:overview:", "dashboard:portal-visibility:"]));

router.get("/levels", getLevels);
router.post("/levels", createLevel);
router.put("/levels/:id", updateLevel);
router.delete("/levels/:id", deleteLevel);

router.get("/staff", getStaff);
router.post("/staff", createStaff);
router.put("/staff/:id", updateStaff);
router.delete("/staff/:id", deleteStaff);

router.get("/structures", getStructures);
router.post("/structures", createStructure);
router.put("/structures/:id", updateStructure);
router.delete("/structures/:id", deleteStructure);

router.get("/assignments", getAssignments);
router.post("/assignments", createAssignments);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);

router.get("/payments", getPayments);
router.post("/payments", createPayment);
router.put("/payments/:id", updatePayment);
router.delete("/payments/:id", deletePayment);

module.exports = router;
