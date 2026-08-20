const mongoose = require("mongoose");

const classSchemeSchema = new mongoose.Schema({
  class_record: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  session: { type: String, required: true, trim: true },
  class: { type: String, required: true, trim: true },
  subjects: [{ type: String, trim: true }],
  pdf_storage: String, pdf_file_id: mongoose.Schema.Types.Mixed, pdf_file_key: String,
  pdf_bucket: String, pdf_mime_type: { type: String, default: "application/pdf" },
  pdf_size: Number, pdf_uploaded_at: Date, file_name: String,
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  status: { type: String, enum: ["approved", "archived"], default: "approved" }
}, { timestamps: true });

classSchemeSchema.index({ class_record: 1, session: 1 }, { unique: true });
module.exports = mongoose.model("ClassScheme", classSchemeSchema);
