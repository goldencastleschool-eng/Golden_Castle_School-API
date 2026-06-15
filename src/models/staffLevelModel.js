const mongoose = require("mongoose");

const staffLevelSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["academic", "non_academic"]
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

staffLevelSchema.index({ category: 1, name: 1 }, { unique: true });
staffLevelSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model("StaffLevel", staffLevelSchema);
