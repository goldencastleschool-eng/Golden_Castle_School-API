const express = require("express");

const router = express.Router();

const {
  getTeachers,
  createTeacher,
  updateTeacher,
  deactivateTeacher,
  resetTeacherPassword,
  deleteTeacher
} = require("../controllers/teacherController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, authorizeRoles("admin"), getTeachers);

router.post("/", protect, authorizeRoles("admin"), createTeacher);

router.put("/:id", protect, authorizeRoles("admin"), updateTeacher);

router.put(
  "/:id/deactivate",
  protect,
  authorizeRoles("admin"),
  deactivateTeacher
);

router.put(
  "/:id/reset-password",
  protect,
  authorizeRoles("admin"),
  resetTeacherPassword
);

router.delete("/:id", protect, authorizeRoles("admin"), deleteTeacher);

module.exports = router;
