const express = require("express");

const router = express.Router();

const {
  uploadCumulativeResult,
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

router.use(invalidateCache(["reports:overview:", "dashboard:portal-visibility:"]));

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
