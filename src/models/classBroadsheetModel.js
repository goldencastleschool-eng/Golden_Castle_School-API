const mongoose = require("mongoose");

const classBroadsheetSchema = new mongoose.Schema(
  {
    session: {
      type: String,
      required: true
    },

    term: {
      type: String,
      required: true
    },

    class: {
      type: String,
      required: true
    },

    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },

    assigned_teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true
    },

    pdf_file_id: {
      type: mongoose.Schema.Types.ObjectId
    },

    pdf_data: {
      type: Buffer
    },

    pdf_mime_type: {
      type: String,
      default: "application/pdf"
    },

    file_name: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

classBroadsheetSchema.index({ createdAt: -1 });
classBroadsheetSchema.index({
  session: 1,
  term: 1,
  class_record: 1,
  createdAt: -1
});
classBroadsheetSchema.index(
  {
    session: 1,
    term: 1,
    class_record: 1,
    assigned_teacher: 1
  },
  {
    unique: true
  }
);
classBroadsheetSchema.index(
  {
    class: "text",
    session: "text",
    term: "text",
    file_name: "text"
  },
  {
    name: "class_broadsheet_search_text",
    weights: {
      class: 6,
      session: 4,
      term: 4,
      file_name: 2
    }
  }
);

module.exports = mongoose.model("ClassBroadsheet", classBroadsheetSchema);
