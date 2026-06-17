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

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router.get("/houses", getHouses);
router.post("/houses", createHouse);
router.put("/houses/:id", updateHouse);
router.delete("/houses/:id", deleteHouse);

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
