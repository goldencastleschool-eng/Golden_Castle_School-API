const express = require("express");

const {
  acknowledgePortalNotice,
  createPortalNotice,
  deletePortalNotice,
  getAdminPortalNotices,
  getPendingPortalNotice,
  updatePortalNotice
} = require("../controllers/portalNoticeController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/admin",
  protect,
  authorizeRoles("admin"),
  getAdminPortalNotices
);

router.post(
  "/admin",
  protect,
  authorizeRoles("admin"),
  createPortalNotice
);

router.put(
  "/admin/:noticeId",
  protect,
  authorizeRoles("admin"),
  updatePortalNotice
);

router.delete(
  "/admin/:noticeId",
  protect,
  authorizeRoles("admin"),
  deletePortalNotice
);

router.get(
  "/pending",
  protect,
  authorizeRoles("student", "teacher"),
  getPendingPortalNotice
);

router.post(
  "/:noticeId/acknowledge",
  protect,
  authorizeRoles("student", "teacher"),
  acknowledgePortalNotice
);

module.exports = router;
