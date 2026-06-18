const express = require("express");

const router = express.Router();

const {
  getClasses,
  createClass,
  updateClass,
  deleteClass
} = require("../controllers/classController");

const protect = require("../middleware/authMiddleware");

const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");

router.use(invalidateCache(["reports:overview:", "dashboard:portal-visibility:"]));

router.get("/", protect, authorizeRoles("admin"), getClasses);

router.post("/", protect, authorizeRoles("admin"), createClass);

router.put("/:id", protect, authorizeRoles("admin"), updateClass);

router.delete("/:id", protect, authorizeRoles("admin"), deleteClass);

module.exports = router;
