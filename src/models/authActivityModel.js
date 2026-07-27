const mongoose = require("mongoose");

const authActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["student", "teacher", "admin", "principal", "chairman"],
      index: true,
    },
    display_name: {
      type: String,
      trim: true,
      default: "",
    },
    identifier: {
      type: String,
      trim: true,
      default: "",
    },
    action: {
      type: String,
      required: true,
      enum: ["login", "logout"],
      index: true,
    },
    ip_address: {
      type: String,
      trim: true,
      default: "",
    },
    user_agent: {
      type: String,
      trim: true,
      default: "",
    },
    occurred_at: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 60 * 60 * 24 * 365,
    },
  },
  {
    timestamps: true,
  }
);

authActivitySchema.index({ occurred_at: -1, role: 1, action: 1 });

module.exports = mongoose.model("AuthActivity", authActivitySchema);
