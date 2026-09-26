const mongoose = require("mongoose");

const admissionApplicationSchema = new mongoose.Schema(
  {
    application_reference: { type: String, required: true, unique: true },
    full_name: { type: String, required: true, trim: true },
    date_of_birth: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    parent_name: { type: String, required: true, trim: true },
    parent_phone: { type: String, required: true, trim: true },
    parent_email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    applying_session: { type: String, required: true, trim: true },
    admission_category: {
      type: String,
      enum: ["regular", "vip", "scholarship"],
      required: true,
      default: "regular"
    },
    boarding_requested: { type: Boolean, default: false },
    preferred_class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", default: null },
    previous_school: { type: String, trim: true, default: "" },
    support_notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["submitted", "under_review", "contacted", "approved", "rejected", "waitlisted", "withdrawn", "converted_to_student"],
      default: "submitted",
      index: true
    },
    admin_note: { type: String, trim: true, default: "" },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewed_at: { type: Date, default: null },
    converted_student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", unique: true, sparse: true },
    conversion_state: { type: String, enum: ["ready", "converting", "converted"], default: "ready" },
    consent_given: { type: Boolean, required: true },
    submitted_ip: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

admissionApplicationSchema.index({ applying_session: 1, status: 1, createdAt: -1 });
admissionApplicationSchema.index({ parent_phone: 1, full_name: 1, date_of_birth: 1 });

module.exports = mongoose.model("AdmissionApplication", admissionApplicationSchema);
