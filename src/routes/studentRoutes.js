const express = require("express");

const router = express.Router();

const {
  registerStudent,
  getAllStudents,
  updateStudent,
  deleteStudent
} = require("../controllers/studentController");

const protect = require("../middleware/authMiddleware");

const authorizeRoles = require("../middleware/roleMiddleware");


// ONLY ADMIN CAN REGISTER STUDENTS
router.post("/", protect, authorizeRoles("admin"), registerStudent);

// ONLY ADMIN CAN VIEW ALL STUDENTS
router.get("/", protect, authorizeRoles("admin"), getAllStudents);

// ONLY ADMIN CAN UPDATE STUDENTS
router.put("/:id", protect, authorizeRoles("admin"), updateStudent);

// ONLY ADMIN CAN DELETE STUDENTS
router.delete("/:id", protect, authorizeRoles("admin"), deleteStudent);

module.exports = router;
