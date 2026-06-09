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
      default: ""
    },

    assigned_class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null
    },

    password: {
      type: String,
      required: true
    },

    initial_password: {
      type: String
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    deactivated_at: {
      type: Date,
      default: null
    },

    deactivation_reason: {
      type: String,
      default: ""
    },

    assignment_history: [
      {
        assigned_class: String,
        assigned_class_record: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Class"
        },
        session: String,
        status: String,
        ended_at: Date,
        reason: String
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Teacher", teacherSchema);
