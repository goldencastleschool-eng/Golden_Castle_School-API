const mongoose = require("mongoose");

const teachingAssignmentSchema = new mongoose.Schema({
  class_subject: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSubject", required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  session: { type: String, required: true, trim: true },
  role: { type: String, enum: ["primary", "assistant"], default: "primary" },
  status: { type: String, enum: ["active", "ended"], default: "active" },
  starts_at: { type: Date, default: Date.now },
  ends_at: { type: Date, default: null },
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  ended_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  change_reason: { type: String, trim: true, default: "" }
}, { timestamps: true });
teachingAssignmentSchema.index({ class_subject: 1, role: 1, status: 1 });
teachingAssignmentSchema.index({ teacher: 1, session: 1, status: 1 });
teachingAssignmentSchema.index({ class_subject: 1, role: 1 }, { unique: true, partialFilterExpression: { status: "active", role: "primary" } });
module.exports = mongoose.model("TeachingAssignment", teachingAssignmentSchema);
