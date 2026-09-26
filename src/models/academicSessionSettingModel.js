const mongoose = require("mongoose");

const academicSessionSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "active_academic_session"
    },
    active_session: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AcademicSessionSetting", academicSessionSettingSchema);
