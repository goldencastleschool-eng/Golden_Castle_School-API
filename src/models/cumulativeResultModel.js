const mongoose = require("mongoose");

const cumulativeResultSchema = new mongoose.Schema(
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

    class: {
      type: String,
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

module.exports = mongoose.model(
  "CumulativeResult",
  cumulativeResultSchema
);
