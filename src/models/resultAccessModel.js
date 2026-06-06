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
      default: ""
    },

    term: {
      type: String,
      default: ""
    },

    cumulative_session: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ResultAccess", resultAccessSchema);
