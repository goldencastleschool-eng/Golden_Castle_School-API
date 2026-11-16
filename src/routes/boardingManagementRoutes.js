const express = require("express");

const {
  getHouses,
  createHouse,
  updateHouse,
  deleteHouse,
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
} = require("../controllers/boardingManagementController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router();

router.use(protect);
router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

router.get("/houses", authorizeRoles("admin"), getHouses);
router.post("/houses", authorizeRoles("admin"), createHouse);
router.put("/houses/:id", authorizeRoles("admin"), updateHouse);
router.delete("/houses/:id", authorizeRoles("admin"), deleteHouse);

router.get("/fee-structures", authorizeRoles("admin", "bursar"), getFeeStructures);
router.post("/fee-structures", authorizeRoles("admin"), createFeeStructure);
router.put("/fee-structures/:id", authorizeRoles("admin"), updateFeeStructure);
router.delete("/fee-structures/:id", authorizeRoles("admin"), deleteFeeStructure);

router.get("/enrollments", authorizeRoles("admin", "bursar"), getEnrollments);
router.post("/enrollments", authorizeRoles("admin"), createEnrollments);
router.put("/enrollments/:id", authorizeRoles("admin"), updateEnrollment);
router.delete("/enrollments/:id", authorizeRoles("admin"), deleteEnrollment);

router.get("/payments", authorizeRoles("admin", "bursar"), getPayments);
router.post("/payments", authorizeRoles("admin", "bursar"), createPayment);
router.put("/payments/:id", authorizeRoles("admin", "bursar"), updatePayment);
router.delete("/payments/:id", authorizeRoles("admin"), deletePayment);

module.exports = router;
