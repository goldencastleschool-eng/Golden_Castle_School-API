const mongoose = require("mongoose");

const academicSessionAuditSchema = new mongoose.Schema(
  {
    previous_session: {
      type: String,
      trim: true,
      default: ""
    },
    active_session: {
      type: String,
      required: true,
      trim: true
    },
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true
    }
  },
  {
    timestamps: true
  }
);

academicSessionAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AcademicSessionAudit", academicSessionAuditSchema);
