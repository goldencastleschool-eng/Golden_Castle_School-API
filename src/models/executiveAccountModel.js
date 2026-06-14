const mongoose = require("mongoose");

const executiveAccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["principal", "chairman"],
      required: true
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

executiveAccountSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model("ExecutiveAccount", executiveAccountSchema);
