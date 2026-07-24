const express = require("express");

const router = express.Router();

const {
  uploadResult,
  uploadBulkResults,
  getAllResults,
  getResultCount,
  getStudentResults,
  updateResult,
  deleteResult,
  viewResult,
  downloadResult
} = require("../controllers/resultController");

const protect = require("../middleware/authMiddleware");

const authorizeRoles = require(
  "../middleware/roleMiddleware"
);
const { invalidateCache } = require("../middleware/cacheMiddleware");

const upload = require(
  "../middleware/uploadMiddleware"
);
const { handleUploadError } = require("../middleware/uploadMiddleware");

router.use(invalidateCache(["reports:overview:", "reports:admin-dashboard:", "dashboard:portal-visibility:"]));

// ADMIN ONLY
router.get(
  "/",
  protect,
  authorizeRoles("admin"),
  getAllResults
);

router.get(
  "/count",
  protect,
  authorizeRoles("admin"),
  getResultCount
);


// ADMIN ONLY
router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  uploadResult
);

router.post(
  "/upload-bulk",
  protect,
  authorizeRoles("admin"),
  upload.array("pdfs", 100),
  handleUploadError,
  uploadBulkResults
);


// ADMIN ONLY
router.put(
  "/:resultId",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  updateResult
);


// ADMIN ONLY
router.delete(
  "/:resultId",
  protect,
  authorizeRoles("admin"),
  deleteResult
);


// STUDENT OR ADMIN
router.get(
  "/:resultId/view",
  protect,
  viewResult
);


// STUDENT OR ADMIN
router.get(
  "/:resultId/download",
  protect,
  downloadResult
);


// STUDENT OR ADMIN
router.get(
  "/student/:studentId",
  protect,
  getStudentResults
);

module.exports = router;
