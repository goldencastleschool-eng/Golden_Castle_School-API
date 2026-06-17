const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

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

    pdf_file_id: {
      type: mongoose.Schema.Types.Mixed
    },

    pdf_storage: {
      type: String,
      default: "gridfs"
    },

    pdf_file_key: {
      type: String
    },

    pdf_bucket: {
      type: String
    },

    pdf_size: {
      type: Number
    },

    pdf_uploaded_at: {
      type: Date
    },

    pdf_migrated_at: {
      type: Date
    },

    legacy_pdf_file_id: {
      type: mongoose.Schema.Types.Mixed
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

resultSchema.index({ createdAt: -1 });
resultSchema.index({ session: 1, term: 1, class: 1, createdAt: -1 });
resultSchema.index(
  {
    class: "text",
    session: "text",
    term: "text",
    file_name: "text"
  },
  {
    name: "result_search_text",
    weights: {
      class: 6,
      session: 4,
      term: 4,
      file_name: 2
    }
  }
);

module.exports = mongoose.model(
  "Result",
  resultSchema
);
