const express = require("express");

const router = express.Router();

const {
  getTeachers,
  createTeacher
} = require("../controllers/teacherController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, authorizeRoles("admin"), getTeachers);

router.post("/", protect, authorizeRoles("admin"), createTeacher);

module.exports = router;
