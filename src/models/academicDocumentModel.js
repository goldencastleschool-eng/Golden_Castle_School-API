const mongoose = require("mongoose");

const academicDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    document_type: { type: String, enum: ["lesson_note", "assignment", "test", "examination"], required: true },
    curriculum_entry: { type: mongoose.Schema.Types.ObjectId, ref: "CurriculumEntry", default: null },
    class_scheme: { type: mongoose.Schema.Types.ObjectId, ref: "ClassScheme", default: null },
    subject: { type: String, trim: true, default: "" },
    template: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicTemplate", default: null },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    generation_request: { type: mongoose.Schema.Types.Mixed, default: {} },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["draft", "in_review", "approved"], default: "draft" },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewed_at: { type: Date, default: null },
    review_note: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

academicDocumentSchema.index({ teacher: 1, status: 1, createdAt: -1 });
academicDocumentSchema.index({ curriculum_entry: 1, document_type: 1 });
academicDocumentSchema.index({ class_scheme: 1, subject: 1, document_type: 1 });

module.exports = mongoose.model("AcademicDocument", academicDocumentSchema);
