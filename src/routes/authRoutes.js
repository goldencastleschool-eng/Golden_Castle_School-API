const express = require("express");

const router = express.Router();

const {
  adminLogin,
  studentLogin,
  changeStudentPassword,
  logout
} = require("../controllers/authController");

const loginRateLimit = require("../middleware/loginRateLimit");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.post("/admin/login", loginRateLimit, adminLogin);

router.post("/student/login", loginRateLimit, studentLogin);

router.put(
  "/student/password",
  protect,
  authorizeRoles("student"),
  changeStudentPassword
);

router.post("/logout", logout);

module.exports = router;
