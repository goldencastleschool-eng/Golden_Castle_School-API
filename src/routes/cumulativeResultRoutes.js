const express = require("express");

const router = express.Router();

const {
  uploadCumulativeResult,
  uploadBulkCumulativeResults,
  getAllCumulativeResults,
  getStudentCumulativeResults,
  getApprovedTeacherCumulativeResults,
  updateCumulativeResult,
  deleteCumulativeResult,
  viewCumulativeResult,
  downloadCumulativeResult
} = require("../controllers/cumulativeResultController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { invalidateCache } = require("../middleware/cacheMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { handleUploadError } = require("../middleware/uploadMiddleware");

router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

router.get(
  "/",
  protect,
  authorizeRoles("admin"),
  getAllCumulativeResults
);

router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  uploadCumulativeResult
);

router.post(
  "/upload-bulk",
  protect,
  authorizeRoles("admin"),
  upload.array("pdfs", 100),
  handleUploadError,
  uploadBulkCumulativeResults
);

router.get(
  "/student/:studentId",
  protect,
  getStudentCumulativeResults
);

router.get(
  "/teacher",
  protect,
  authorizeRoles("teacher"),
  getApprovedTeacherCumulativeResults
);

router.put(
  "/:resultId",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  updateCumulativeResult
);

router.delete(
  "/:resultId",
  protect,
  authorizeRoles("admin"),
  deleteCumulativeResult
);

router.get(
  "/:resultId/view",
  protect,
  viewCumulativeResult
);

router.get(
  "/:resultId/download",
  protect,
  downloadCumulativeResult
);

module.exports = router;
