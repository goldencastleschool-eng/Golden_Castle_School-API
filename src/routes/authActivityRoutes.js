const express = require("express");

const router = express.Router();

const { getAuthActivity } = require("../controllers/authActivityController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, authorizeRoles("admin"), getAuthActivity);

module.exports = router;
