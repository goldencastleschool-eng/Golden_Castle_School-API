const mongoose = require("mongoose");
const { VALID_FEE_CATEGORIES } = require("../utils/feeCategories");

const studentSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true
    },

    admission_no: {
      type: String,
      required: true,
      unique: true
    },

    class: {
      type: String,
      required: true
    },

    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class"
    },

    current_session: {
      type: String,
      required: true
    },

    gender: {
      type: String
    },

    status: {
      type: String,
      enum: ["active", "graduated", "left"],
      default: "active"
    },

    graduated_at: {
      type: Date
    },

    graduation_session: {
      type: String
    },

    graduation_class: {
      type: String
    },

    left_at: {
      type: Date
    },

    left_session: {
      type: String
    },

    left_term: {
      type: String
    },

    left_class: {
      type: String
    },

    fee_enrollments: [
      {
        session: {
          type: String,
          required: true,
          trim: true
        },
        term: {
          type: String,
          required: true,
          enum: ["First Term", "Second Term", "Third Term"]
        },
        fee_category: {
          type: String,
          required: true,
          enum: VALID_FEE_CATEGORIES,
          default: "returning"
        },
        discount_amount: {
          type: Number,
          min: 0,
          default: 0
        },
        discount_reason: {
          type: String,
          trim: true,
          default: ""
        },
        class_record: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Class"
        },
        class: {
          type: String,
          trim: true
        }
      }
    ],

    password: {
      type: String,
      required: true
    },

    initial_password: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

studentSchema.index({ createdAt: -1 });
studentSchema.index({ current_session: 1, class_record: 1, createdAt: -1 });
studentSchema.index({ current_session: 1, class: 1, createdAt: -1 });
studentSchema.index(
  {
    full_name: "text",
    admission_no: "text",
    class: "text",
    current_session: "text",
    gender: "text"
  },
  {
    name: "student_search_text",
    weights: {
      full_name: 10,
      admission_no: 10,
      class: 4,
      current_session: 2,
      gender: 1
    }
  }
);

module.exports = mongoose.model("Student", studentSchema);
