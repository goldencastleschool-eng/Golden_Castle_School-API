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

    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class"
    },

    current_session: {
      type: String,
      required: true
    },

    gender: {
      type: String
    },

    status: {
      type: String,
      enum: ["active", "graduated", "left"],
      default: "active"
    },

    graduated_at: {
      type: Date
    },

    graduation_session: {
      type: String
    },

    graduation_class: {
      type: String
    },

    left_at: {
      type: Date
    },

    left_session: {
      type: String
    },

    left_term: {
      type: String
    },

    left_class: {
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
