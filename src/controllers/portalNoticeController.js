const PortalNotice = require("../models/portalNoticeModel");
const PortalNoticeAcknowledgement = require("../models/portalNoticeAcknowledgementModel");
const Student = require("../models/studentModel");
const Teacher = require("../models/teacherModel");

const allowedPortals = ["student", "teacher", "both"];

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const applyPlaceholders = (message = "", profile = {}, role = "") => {
  const values = {
    name: profile.full_name || profile.username || "User",
    admission_no: profile.admission_no || "",
    class: profile.class || profile.assigned_class || "",
    session: profile.current_session || profile.session || "",
    username: profile.username || "",
    role
  };

  return message.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
};

const buildNoticePayload = (notice, profile = {}, role = "") => ({
  id: notice._id,
  title: applyPlaceholders(notice.title, profile, role),
  message: applyPlaceholders(notice.message, profile, role),
  portal: notice.portal,
  starts_at: notice.starts_at,
  ends_at: notice.ends_at,
  createdAt: notice.createdAt,
  updatedAt: notice.updatedAt
});

const validateNoticePayload = (body = {}) => {
  const title = body.title?.toString().trim();
  const message = body.message?.toString().trim();
  const portal = body.portal?.toString().trim() || "both";
  const startsAt = normalizeDate(body.starts_at);
  const endsAt = normalizeDate(body.ends_at);

  if (!title) {
    return { error: "Notice title is required." };
  }

  if (!message) {
    return { error: "Notice message is required." };
  }

  if (!allowedPortals.includes(portal)) {
    return { error: "Notice portal must be student, teacher, or both." };
  }

  if (startsAt && endsAt && startsAt > endsAt) {
    return { error: "Start date cannot be after end date." };
  }

  return {
    value: {
      title,
      message,
      portal,
      is_active: body.is_active !== false,
      starts_at: startsAt,
      ends_at: endsAt
    }
  };
};

const getActiveNoticeQuery = (role) => {
  const now = new Date();

  return {
    is_active: true,
    portal: { $in: [role, "both"] },
    $and: [
      {
        $or: [{ starts_at: null }, { starts_at: { $lte: now } }]
      },
      {
        $or: [{ ends_at: null }, { ends_at: { $gte: now } }]
      }
    ]
  };
};

const getCurrentUserProfile = async (req) => {
  if (req.user.role === "student") {
    return Student.findById(req.user.id)
      .select("full_name admission_no class current_session")
      .lean();
  }

  if (req.user.role === "teacher") {
    return Teacher.findById(req.user.id)
      .select("full_name username assigned_class session status")
      .lean();
  }

  return null;
};

const getAdminPortalNotices = async (req, res) => {
  try {
    const notices = await PortalNotice.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json(notices);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createPortalNotice = async (req, res) => {
  try {
    const { value, error } = validateNoticePayload(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const notice = await PortalNotice.create({
      ...value,
      created_by: req.user.id,
      updated_by: req.user.id
    });

    return res.status(201).json(notice);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updatePortalNotice = async (req, res) => {
  try {
    const { value, error } = validateNoticePayload(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const existingNotice = await PortalNotice.findById(req.params.noticeId).lean();

    if (!existingNotice) {
      return res.status(404).json({ message: "Notice not found." });
    }

    const notice = await PortalNotice.findByIdAndUpdate(
      req.params.noticeId,
      {
        ...value,
        updated_by: req.user.id
      },
      {
        new: true,
        runValidators: true
      }
    );

    const changedReadableContent =
      existingNotice.title !== value.title ||
      existingNotice.message !== value.message ||
      existingNotice.portal !== value.portal ||
      Boolean(existingNotice.is_active) !== Boolean(value.is_active) ||
      new Date(existingNotice.starts_at || 0).getTime() !==
        new Date(value.starts_at || 0).getTime() ||
      new Date(existingNotice.ends_at || 0).getTime() !==
        new Date(value.ends_at || 0).getTime();

    if (changedReadableContent) {
      await PortalNoticeAcknowledgement.deleteMany({ notice: notice._id });
    }

    return res.json(notice);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deletePortalNotice = async (req, res) => {
  try {
    const notice = await PortalNotice.findByIdAndDelete(req.params.noticeId);

    if (!notice) {
      return res.status(404).json({ message: "Notice not found." });
    }

    await PortalNoticeAcknowledgement.deleteMany({ notice: notice._id });

    return res.json({ message: "Notice deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPendingPortalNotice = async (req, res) => {
  try {
    if (!["student", "teacher"].includes(req.user.role)) {
      return res.json({ notice: null });
    }

    const acknowledgedNoticeIds = await PortalNoticeAcknowledgement.find({
      user: req.user.id,
      user_role: req.user.role
    }).distinct("notice");

    const notice = await PortalNotice.findOne({
      ...getActiveNoticeQuery(req.user.role),
      _id: { $nin: acknowledgedNoticeIds }
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!notice) {
      return res.json({ notice: null });
    }

    const profile = await getCurrentUserProfile(req);

    return res.json({
      notice: buildNoticePayload(notice, profile, req.user.role)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const acknowledgePortalNotice = async (req, res) => {
  try {
    if (!["student", "teacher"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const notice = await PortalNotice.findOne({
      _id: req.params.noticeId,
      ...getActiveNoticeQuery(req.user.role)
    }).lean();

    if (!notice) {
      return res.status(404).json({ message: "Active notice not found." });
    }

    await PortalNoticeAcknowledgement.findOneAndUpdate(
      {
        notice: notice._id,
        user: req.user.id,
        user_role: req.user.role
      },
      {
        acknowledged_at: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return res.json({ message: "Notice acknowledged successfully." });
  } catch (error) {
    if (error.code === 11000) {
      return res.json({ message: "Notice already acknowledged." });
    }

    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminPortalNotices,
  createPortalNotice,
  updatePortalNotice,
  deletePortalNotice,
  getPendingPortalNotice,
  acknowledgePortalNotice
};
