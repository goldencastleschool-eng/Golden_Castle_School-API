const mongoose = require("mongoose");

const boardingEnrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },
    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    class: {
      type: String,
      required: true,
      trim: true
    },
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoardingHouse",
      required: true
    },
    session: {
      type: String,
      required: true,
      trim: true
    },
    term: {
      type: String,
      required: true,
      enum: ["First Term", "Second Term", "Third Term"]
    },
    status: {
      type: String,
      enum: ["active", "left", "transferred"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

boardingEnrollmentSchema.index(
  { student: 1, session: 1, term: 1 },
  { unique: true }
);
boardingEnrollmentSchema.index({ house: 1, session: 1, term: 1, status: 1 });
boardingEnrollmentSchema.index({ class_record: 1, session: 1, term: 1 });

module.exports = mongoose.model("BoardingEnrollment", boardingEnrollmentSchema);
