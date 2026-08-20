const mongoose = require("mongoose");

const curriculumEntrySchema = new mongoose.Schema(
  {
    level: { type: String, required: true, trim: true },
    class_name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    session: { type: String, required: true, trim: true },
    term: { type: String, required: true, trim: true },
    week: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    learning_objectives: [{ type: String, trim: true }],
    content: { type: String, required: true, trim: true },
    source_title: { type: String, trim: true, default: "School scheme of work" },
    status: { type: String, enum: ["draft", "approved"], default: "draft" },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }
  },
  { timestamps: true }
);

curriculumEntrySchema.index({ class_name: 1, subject: 1, session: 1, term: 1, week: 1 }, { unique: true });
curriculumEntrySchema.index({ status: 1, level: 1, subject: 1 });

module.exports = mongoose.model("CurriculumEntry", curriculumEntrySchema);
