const mongoose = require("mongoose");
const {
  VALID_BUS_PAYMENT_CATEGORIES
} = require("../utils/busPaymentCategories");

const busPaymentSchema = new mongoose.Schema(
  {
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusEnrollment",
      required: true
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusRoute",
      required: true
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

    expected_amount_at_payment: {
      type: Number,
      min: 0,
      default: 0
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

    payment_category: {
      type: String,
      enum: VALID_BUS_PAYMENT_CATEGORIES,
      default: "both"
    },

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

busPaymentSchema.index({ enrollment: 1, payment_date: -1 });
busPaymentSchema.index({ student: 1, session: 1, term: 1 });
busPaymentSchema.index({ route: 1, session: 1, term: 1 });

module.exports = mongoose.model("BusPayment", busPaymentSchema);
