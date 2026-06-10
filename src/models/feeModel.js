const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
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

module.exports = mongoose.model("Fee", feeSchema);
