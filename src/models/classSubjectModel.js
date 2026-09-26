const mongoose = require("mongoose");

const classSubjectSchema = new mongoose.Schema({
  class_record: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  session: { type: String, required: true, trim: true },
  subject_record: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
  subject: { type: String, required: true, trim: true },
  assessment_policy: {
    first_ca_max: { type: Number, min: 0, default: 20 },
    second_ca_max: { type: Number, min: 0, default: 20 },
    exam_max: { type: Number, min: 0, default: 60 }
  },
  assigned_teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  status: { type: String, enum: ["active", "archived"], default: "active" }
}, { timestamps: true });
classSubjectSchema.index({ class_record: 1, subject: 1 }, { unique: true });
classSubjectSchema.index({ assigned_teacher: 1, session: 1, status: 1 });
module.exports = mongoose.model("ClassSubject", classSubjectSchema);
