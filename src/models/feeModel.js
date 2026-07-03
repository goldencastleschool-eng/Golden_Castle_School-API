const mongoose = require("mongoose");
const { VALID_FEE_CATEGORIES } = require("../utils/feeCategories");

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class"
    },

    class: {
      type: String,
      trim: true,
      default: ""
    },

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
      enum: VALID_FEE_CATEGORIES,
      default: "returning"
    },

    expected_amount_at_payment: {
      type: Number,
      default: 0,
      min: 0
    },

    base_expected_amount_at_payment: {
      type: Number,
      default: 0,
      min: 0
    },

    discount_amount_at_payment: {
      type: Number,
      default: 0,
      min: 0
    },

    discount_reason_at_payment: {
      type: String,
      trim: true,
      default: ""
    },

    expected_items_at_payment: [
      {
        name: {
          type: String,
          trim: true
        },
        amount: {
          type: Number,
          min: 0,
          default: 0
        }
      }
    ],

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    payment_date: {
      type: Date,
      required: true
    },

    payment_method: {
      type: String,
      trim: true,
      default: ""
    },

    receipt_no: {
      type: String,
      trim: true,
      default: ""
    },

    note: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

feeSchema.index({ student: 1, session: 1, term: 1, payment_date: -1 });
feeSchema.index({ class_record: 1, session: 1, term: 1, fee_category: 1 });
feeSchema.index({ payment_date: -1, createdAt: -1 });
feeSchema.index({ session: 1, term: 1, payment_date: -1 });
feeSchema.index(
  {
    receipt_no: "text",
    class: "text",
    session: "text",
    term: "text",
    fee_category: "text",
    payment_method: "text",
    note: "text"
  },
  {
    name: "fee_search_text",
    weights: {
      receipt_no: 10,
      class: 5,
      session: 4,
      term: 4,
      fee_category: 3,
      payment_method: 2,
      note: 1
    }
  }
);

module.exports = mongoose.model("Fee", feeSchema);
