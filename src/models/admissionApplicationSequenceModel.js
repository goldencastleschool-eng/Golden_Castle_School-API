const mongoose = require("mongoose");

const admissionApplicationSequenceSchema = new mongoose.Schema({
  session: { type: String, required: true, unique: true, trim: true },
  last_serial: { type: Number, required: true, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model("AdmissionApplicationSequence", admissionApplicationSequenceSchema);
