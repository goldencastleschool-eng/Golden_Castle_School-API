const express = require("express");

const router = express.Router();

const {
  adminLogin,
  studentLogin,
  teacherLogin,
  changeStudentPassword,
  changeTeacherPassword,
  logout
} = require("../controllers/authController");

const loginRateLimit = require("../middleware/loginRateLimit");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.post("/admin/login", loginRateLimit, adminLogin);

router.post("/student/login", loginRateLimit, studentLogin);

router.post("/teacher/login", loginRateLimit, teacherLogin);

router.put(
  "/student/password",
  protect,
  authorizeRoles("student"),
  changeStudentPassword
);

router.put(
  "/teacher/password",
  protect,
  authorizeRoles("teacher"),
  changeTeacherPassword
);

router.post("/logout", logout);

module.exports = router;
