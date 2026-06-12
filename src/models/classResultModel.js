const mongoose = require("mongoose");

const classResultSchema = new mongoose.Schema(
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

classResultSchema.index(
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
classResultSchema.index(
  {
    class: "text",
    session: "text",
    term: "text",
    file_name: "text"
  },
  {
    name: "class_result_search_text",
    weights: {
      class: 6,
      session: 4,
      term: 4,
      file_name: 2
    }
  }
);

module.exports = mongoose.model("ClassResult", classResultSchema);
