const express = require("express");

const router = express.Router();

const {
  getClassResults,
  uploadClassResult,
  deleteClassResult,
  getApprovedTeacherClassResults,
  viewClassResult,
  downloadClassResult
} = require("../controllers/classResultController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { handleUploadError } = require("../middleware/uploadMiddleware");

router.get("/", protect, authorizeRoles("admin"), getClassResults);

router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  handleUploadError,
  uploadClassResult
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
