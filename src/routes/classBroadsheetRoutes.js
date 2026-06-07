const express = require("express");

const router = express.Router();

const {
  getClassBroadsheets,
  uploadClassBroadsheet,
  deleteClassBroadsheet,
  getApprovedTeacherBroadsheets,
  viewClassBroadsheet,
  downloadClassBroadsheet
} = require("../controllers/classBroadsheetController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { handleUploadError } = require("../middleware/uploadMiddleware");

router.get("/", protect, authorizeRoles("admin"), getClassBroadsheets);

router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  handleUploadError,
  uploadClassBroadsheet
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
