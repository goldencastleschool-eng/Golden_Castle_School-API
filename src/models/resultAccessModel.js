const mongoose = require("mongoose");

const resultAccessSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "active-result-access",
      unique: true
    },

    session: {
      type: String,
      required: true
    },

    term: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ResultAccess", resultAccessSchema);
