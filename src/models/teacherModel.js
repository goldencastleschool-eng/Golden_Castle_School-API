const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true
    },

    username: {
      type: String,
      required: true,
      unique: true
    },

    session: {
      type: String,
      required: true
    },

    assigned_class: {
      type: String,
      required: true
    },

    assigned_class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },

    password: {
      type: String,
      required: true
    },

    initial_password: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Teacher", teacherSchema);
