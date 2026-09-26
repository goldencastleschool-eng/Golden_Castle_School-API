const mongoose = require("mongoose");

const studentSubjectScoreSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  class_subject: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSubject", required: true },
  session: { type: String, required: true },
  term: { type: String, required: true, enum: ["First Term", "Second Term", "Third Term"] },
  first_ca: { type: Number, min: 0, default: 0 },
  second_ca: { type: Number, min: 0, default: 0 },
  exam: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ["draft", "submitted", "locked"], default: "draft" },
  entered_by: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  teaching_assignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeachingAssignment", default: null },
  submitted_at: { type: Date, default: null },
  locked_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  locked_at: { type: Date, default: null }
}, { timestamps: true });
studentSubjectScoreSchema.index({ student: 1, class_subject: 1, session: 1, term: 1 }, { unique: true });
module.exports = mongoose.model("StudentSubjectScore", studentSubjectScoreSchema);
