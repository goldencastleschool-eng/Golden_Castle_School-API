const express = require("express");

const {
  getBuses,
  createBus,
  updateBus,
  deleteBus,
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getEnrollments,
  createEnrollments,
  updateEnrollment,
  deleteEnrollment,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment
} = require("../controllers/busManagementController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin"));
router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

router.get("/buses", getBuses);
router.post("/buses", createBus);
router.put("/buses/:id", updateBus);
router.delete("/buses/:id", deleteBus);

router.get("/routes", getRoutes);
router.post("/routes", createRoute);
router.put("/routes/:id", updateRoute);
router.delete("/routes/:id", deleteRoute);

router.get("/fee-structures", getFeeStructures);
router.post("/fee-structures", createFeeStructure);
router.put("/fee-structures/:id", updateFeeStructure);
router.delete("/fee-structures/:id", deleteFeeStructure);

router.get("/enrollments", getEnrollments);
router.post("/enrollments", createEnrollments);
router.put("/enrollments/:id", updateEnrollment);
router.delete("/enrollments/:id", deleteEnrollment);

router.get("/payments", getPayments);
router.post("/payments", createPayment);
router.put("/payments/:id", updatePayment);
router.delete("/payments/:id", deletePayment);

module.exports = router;
