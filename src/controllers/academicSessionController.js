const Class = require("../models/classModel");
const AcademicSessionSetting = require("../models/academicSessionSettingModel");
const AcademicSessionAudit = require("../models/academicSessionAuditModel");
const { getSessionEndingYear } = require("../utils/admissionNumbers");

const SETTING_KEY = "active_academic_session";

const getAcademicSessions = async (req, res) => {
  try {
    const [setting, sessions] = await Promise.all([
      AcademicSessionSetting.findOne({ key: SETTING_KEY }).lean(),
      Class.distinct("session", { session: { $exists: true, $ne: "" } })
    ]);

    res.json({
      active_session: setting?.active_session || "",
      sessions: sessions
        .filter((session) => getSessionEndingYear(session))
        .sort()
        .reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setActiveAcademicSession = async (req, res) => {
  try {
    const session = req.body.session?.toString().trim();

    if (!getSessionEndingYear(session)) {
      return res.status(400).json({
        message: "Session must use the format YYYY/YYYY, such as 2026/2027"
      });
    }

    const classCount = await Class.countDocuments({ session });

    if (classCount === 0) {
      return res.status(400).json({
        message: "Create at least one class for this session before making it active"
      });
    }

    const previousSetting = await AcademicSessionSetting.findOne({
      key: SETTING_KEY
    });
    const previousSession = previousSetting?.active_session || "";
    const setting = await AcademicSessionSetting.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { active_session: session } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (previousSession !== session) {
      await AcademicSessionAudit.create({
        previous_session: previousSession,
        active_session: session,
        changed_by: req.user.id
      });
    }

    res.json({
      active_session: setting.active_session,
      message: `${setting.active_session} is now the active academic session`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAcademicSessions,
  setActiveAcademicSession
};
