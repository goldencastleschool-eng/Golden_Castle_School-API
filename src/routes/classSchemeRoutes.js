const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getSchemes, uploadScheme } = require("../controllers/classSchemeController");
const router = express.Router();
router.get("/", protect, authorizeRoles("admin", "teacher"), getSchemes);
router.post("/", protect, authorizeRoles("admin"), upload.single("pdf"), uploadScheme);
module.exports = router;
