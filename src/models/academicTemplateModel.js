const mongoose = require("mongoose");

const academicTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    document_type: { type: String, enum: ["lesson_note", "assignment", "test", "examination"], required: true },
    header_text: { type: String, required: true, trim: true },
    instructions: { type: String, trim: true, default: "" },
    sections: [{ type: String, trim: true }],
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }
  },
  { timestamps: true }
);

academicTemplateSchema.index({ document_type: 1, is_active: 1 });

module.exports = mongoose.model("AcademicTemplate", academicTemplateSchema);
