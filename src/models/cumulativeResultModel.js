const mongoose = require("mongoose");

const cumulativeResultSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null
    },

    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null
    },

    assigned_teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null
    },

    session: {
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

cumulativeResultSchema.index({ createdAt: -1 });
cumulativeResultSchema.index({ session: 1, class: 1, createdAt: -1 });
cumulativeResultSchema.index({
  session: 1,
  class_record: 1,
  assigned_teacher: 1,
  createdAt: -1
});
cumulativeResultSchema.index(
  {
    class: "text",
    session: "text",
    file_name: "text"
  },
  {
    name: "cumulative_result_search_text",
    weights: {
      class: 6,
      session: 4,
      file_name: 2
    }
  }
);

module.exports = mongoose.model(
  "CumulativeResult",
  cumulativeResultSchema
);
