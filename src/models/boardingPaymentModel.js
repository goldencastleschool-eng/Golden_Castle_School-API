const mongoose = require("mongoose");

const boardingPaymentSchema = new mongoose.Schema(
  {
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoardingEnrollment",
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoardingHouse",
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
        name: String,
        amount: Number
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

boardingPaymentSchema.index({ enrollment: 1, payment_date: -1 });
boardingPaymentSchema.index({ student: 1, session: 1, term: 1 });
boardingPaymentSchema.index({ house: 1, session: 1, term: 1 });
boardingPaymentSchema.index({ session: 1, term: 1, enrollment: 1 });

module.exports = mongoose.model("BoardingPayment", boardingPaymentSchema);
