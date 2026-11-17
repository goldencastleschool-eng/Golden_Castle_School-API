const express = require("express");
const { getTemplates, saveTemplate, publishTemplate } = require("../controllers/feeSectionTemplateController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router();
router.use(protect, invalidateCache(["reports:overview:", "reports:admin-dashboard:"]));
router.get("/", authorizeRoles("admin", "bursar"), getTemplates);
router.post("/", authorizeRoles("admin"), saveTemplate);
router.post("/:id/publish", authorizeRoles("admin"), publishTemplate);
module.exports = router;
