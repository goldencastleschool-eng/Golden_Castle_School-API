const mongoose = require("mongoose");

const studentTransitionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["promoted", "demoted", "graduated"],
      required: true
    },
    from_session: {
      type: String,
      required: true,
      trim: true
    },
    from_class: {
      type: String,
      required: true,
      trim: true
    },
    from_class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class"
    },
    to_session: {
      type: String,
      required: true,
      trim: true
    },
    to_class: {
      type: String,
      required: true,
      trim: true
    },
    to_class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class"
    },
    remark: {
      type: String,
      trim: true,
      default: ""
    },
    is_published: {
      type: Boolean,
      default: true,
      index: true
    },
    decided_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

studentTransitionSchema.index({ student: 1, decided_at: -1 });
studentTransitionSchema.index({ from_session: 1, to_session: 1, status: 1 });

module.exports = mongoose.model("StudentTransition", studentTransitionSchema);
