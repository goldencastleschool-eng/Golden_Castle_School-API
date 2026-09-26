const mongoose = require("mongoose");

const admissionSequenceSchema = new mongoose.Schema(
  {
    session: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    last_serial: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AdmissionSequence", admissionSequenceSchema);
