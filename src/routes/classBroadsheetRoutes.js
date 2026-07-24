const express = require("express");

const router = express.Router();

const {
  getClassBroadsheets,
  uploadClassBroadsheet,
  uploadBulkClassBroadsheets,
  deleteClassBroadsheet,
  getApprovedTeacherBroadsheets,
  viewClassBroadsheet,
  downloadClassBroadsheet
} = require("../controllers/classBroadsheetController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { handleUploadError } = require("../middleware/uploadMiddleware");

router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

router.get("/", protect, authorizeRoles("admin"), getClassBroadsheets);

router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  handleUploadError,
  uploadClassBroadsheet
);

router.post(
  "/upload-bulk",
  protect,
  authorizeRoles("admin"),
  upload.array("pdfs", 100),
  handleUploadError,
  uploadBulkClassBroadsheets
);

router.get(
  "/teacher",
  protect,
  authorizeRoles("teacher"),
  getApprovedTeacherBroadsheets
);

router.get(
  "/:broadsheetId/view",
  protect,
  authorizeRoles("admin", "teacher"),
  viewClassBroadsheet
);

router.get(
  "/:broadsheetId/download",
  protect,
  authorizeRoles("admin", "teacher"),
  downloadClassBroadsheet
);

router.delete(
  "/:broadsheetId",
  protect,
  authorizeRoles("admin"),
  deleteClassBroadsheet
);

module.exports = router;
