const mongoose = require("mongoose");

const levelCurriculumSchema = new mongoose.Schema({
  section: { type: String, enum: ["pre_nursery", "nursery", "basic", "secondary"], required: true },
  subject_record: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  assessment_policy: {
    first_ca_max: { type: Number, min: 0, default: 20 },
    second_ca_max: { type: Number, min: 0, default: 20 },
    exam_max: { type: Number, min: 0, default: 60 }
  },
  status: { type: String, enum: ["active", "archived"], default: "active" }
}, { timestamps: true });

levelCurriculumSchema.index({ section: 1, subject_record: 1 }, { unique: true });
module.exports = mongoose.model("LevelCurriculum", levelCurriculumSchema);
