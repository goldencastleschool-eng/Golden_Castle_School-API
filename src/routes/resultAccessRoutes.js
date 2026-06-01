const express = require("express");

const router = express.Router();

const {
  getResultAccess,
  updateResultAccess
} = require("../controllers/resultAccessController");

const protect = require("../middleware/authMiddleware");

const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, getResultAccess);

router.put("/", protect, authorizeRoles("admin"), updateResultAccess);

module.exports = router;
