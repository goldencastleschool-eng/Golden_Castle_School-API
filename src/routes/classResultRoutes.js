const express = require("express");

const router = express.Router();

const {
  getClassResults,
  uploadClassResult,
  uploadBulkClassResults,
  deleteClassResult,
  getApprovedTeacherClassResults,
  viewClassResult,
  downloadClassResult
} = require("../controllers/classResultController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { handleUploadError } = require("../middleware/uploadMiddleware");

router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

router.get("/", protect, authorizeRoles("admin"), getClassResults);

router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  handleUploadError,
  uploadClassResult
);

router.post(
  "/upload-bulk",
  protect,
  authorizeRoles("admin"),
  upload.array("pdfs", 100),
  handleUploadError,
  uploadBulkClassResults
);

router.get(
  "/teacher",
  protect,
  authorizeRoles("teacher"),
  getApprovedTeacherClassResults
);

router.get(
  "/:classResultId/view",
  protect,
  authorizeRoles("admin", "teacher"),
  viewClassResult
);

router.get(
  "/:classResultId/download",
  protect,
  authorizeRoles("admin", "teacher"),
  downloadClassResult
);

router.delete(
  "/:classResultId",
  protect,
  authorizeRoles("admin"),
  deleteClassResult
);

module.exports = router;
