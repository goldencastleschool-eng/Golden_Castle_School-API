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
    },

    broadsheet_session: {
      type: String,
      default: ""
    },

    broadsheet_term: {
      type: String,
      default: ""
    },

    class_result_session: {
      type: String,
      default: ""
    },

    class_result_term: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ResultAccess", resultAccessSchema);
