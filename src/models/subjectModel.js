const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true, default: "" },
  status: { type: String, enum: ["active", "archived"], default: "active" }
}, { timestamps: true });
subjectSchema.index({ name: 1 }, { unique: true });
subjectSchema.index({ code: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("Subject", subjectSchema);
