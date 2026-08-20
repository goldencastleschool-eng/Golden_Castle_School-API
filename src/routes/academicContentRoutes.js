const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const controller = require("../controllers/academicContentController");

router.use(protect, authorizeRoles("admin", "teacher"));
router.get("/curricula", controller.getCurricula);
router.post("/curricula", authorizeRoles("admin"), controller.createCurriculum);
router.put("/curricula/:id", authorizeRoles("admin"), controller.updateCurriculum);
router.get("/templates", controller.getTemplates);
router.post("/templates", authorizeRoles("admin"), controller.createTemplate);
router.get("/documents", controller.getDocuments);
router.post("/documents/generate", authorizeRoles("teacher"), controller.generateDocument);
router.put("/documents/:id/review", authorizeRoles("admin"), controller.reviewDocument);

module.exports = router;
