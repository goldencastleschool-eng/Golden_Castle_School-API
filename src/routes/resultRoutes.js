const express = require("express");

const router = express.Router();

const {
  uploadResult,
  getAllResults,
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

const upload = require(
  "../middleware/uploadMiddleware"
);


// ADMIN ONLY
router.get(
  "/",
  protect,
  authorizeRoles("admin"),
  getAllResults
);


// ADMIN ONLY
router.post(
  "/upload",
  protect,
  authorizeRoles("admin"),
  upload.single("pdf"),
  uploadResult
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
