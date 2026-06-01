const express = require("express");

const router = express.Router();

const {
  adminLogin,
  studentLogin,
  logout
} = require("../controllers/authController");

const loginRateLimit = require("../middleware/loginRateLimit");

router.post("/admin/login", loginRateLimit, adminLogin);

router.post("/student/login", loginRateLimit, studentLogin);

router.post("/logout", logout);

module.exports = router;
