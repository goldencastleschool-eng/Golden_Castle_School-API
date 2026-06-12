const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    session: {
      type: String,
      required: true,
      trim: true
    },

    section: {
      type: String,
      enum: ["pre_nursery", "nursery", "basic", "secondary"],
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

classSchema.index({ name: 1, session: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);
