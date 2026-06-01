const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true
    },

    admission_no: {
      type: String,
      required: true,
      unique: true
    },

    class: {
      type: String,
      required: true
    },

    gender: {
      type: String
    },

    password: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Student", studentSchema);