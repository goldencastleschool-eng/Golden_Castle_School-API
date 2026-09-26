const express = require("express");

const router = express.Router();
const {
  getAcademicSessions,
  setActiveAcademicSession
} = require("../controllers/academicSessionController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, authorizeRoles("admin"), getAcademicSessions);
router.put("/active", protect, authorizeRoles("admin"), setActiveAcademicSession);

module.exports = router;
