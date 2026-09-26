const express = require("express");
const router = express.Router();
const controller = require("../controllers/admissionApplicationController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { createRateLimit } = require("../middleware/rateLimitMiddleware");

router.get("/public-options", controller.getPublicAdmissionOptions);
router.post("/public", createRateLimit({ max: 5, windowMs: 60 * 60 * 1000, prefix: "admission-application", message: "Too many applications from this connection. Please try again later." }), controller.submitApplication);
router.post("/track", createRateLimit({ max: 10, windowMs: 60 * 60 * 1000, prefix: "admission-tracking", message: "Too many status checks from this connection. Please try again later." }), controller.trackApplication);
router.get("/", protect, authorizeRoles("admin"), controller.listApplications);
router.get("/:id/registration", protect, authorizeRoles("admin"), controller.getApplicationForRegistration);
router.put("/:id/status", protect, authorizeRoles("admin"), controller.updateApplicationStatus);
router.post("/:id/convert", protect, authorizeRoles("admin"), controller.convertApplication);
module.exports = router;
