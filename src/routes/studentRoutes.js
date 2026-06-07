const express = require("express");

const router = express.Router();

const {
  registerStudent,
  getAllStudents,
  updateStudent,
  resetStudentPassword,
  deleteStudent,
  promoteStudentsByClass,
  graduateStudents,
  restoreGraduatedStudents,
  markStudentsLeftSchool
} = require("../controllers/studentController");

const protect = require("../middleware/authMiddleware");

const authorizeRoles = require("../middleware/roleMiddleware");


// ONLY ADMIN CAN REGISTER STUDENTS
router.post("/", protect, authorizeRoles("admin"), registerStudent);

// ONLY ADMIN CAN VIEW ALL STUDENTS
router.get("/", protect, authorizeRoles("admin"), getAllStudents);

// ONLY ADMIN CAN PROMOTE STUDENTS BY CLASS
router.post("/promote", protect, authorizeRoles("admin"), promoteStudentsByClass);

// ONLY ADMIN CAN GRADUATE STUDENTS
router.post("/graduate", protect, authorizeRoles("admin"), graduateStudents);

// ONLY ADMIN CAN RESTORE GRADUATED STUDENTS
router.post(
  "/restore-graduated",
  protect,
  authorizeRoles("admin"),
  restoreGraduatedStudents
);

// ONLY ADMIN CAN MARK STUDENTS AS LEFT SCHOOL
router.post(
  "/left-school",
  protect,
  authorizeRoles("admin"),
  markStudentsLeftSchool
);

// ONLY ADMIN CAN RESET STUDENT PASSWORD
router.put(
  "/:id/reset-password",
  protect,
  authorizeRoles("admin"),
  resetStudentPassword
);

// ONLY ADMIN CAN UPDATE STUDENTS
router.put("/:id", protect, authorizeRoles("admin"), updateStudent);

// ONLY ADMIN CAN DELETE STUDENTS
router.delete("/:id", protect, authorizeRoles("admin"), deleteStudent);

module.exports = router;
