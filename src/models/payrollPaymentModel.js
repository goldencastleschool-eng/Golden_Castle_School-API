const mongoose = require("mongoose");

const payrollPaymentSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollAssignment",
      required: true
    },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollStaff",
      required: true
    },

    category: {
      type: String,
      required: true,
      enum: ["academic", "non_academic"]
    },

    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffLevel",
      required: true
    },

    level_name: {
      type: String,
      trim: true,
      default: ""
    },

    session: {
      type: String,
      required: true,
      trim: true
    },

    period_type: {
      type: String,
      required: true,
      enum: ["monthly", "termly"]
    },

    period: {
      type: String,
      required: true,
      trim: true
    },

    expected_net_at_payment: {
      type: Number,
      required: true,
      min: 0
    },

    earnings_snapshot: [
      {
        name: String,
        amount: Number
      }
    ],

    deductions_snapshot: [
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

    reference_no: {
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

payrollPaymentSchema.index({ assignment: 1, payment_date: -1 });
payrollPaymentSchema.index({ staff: 1, session: 1, period_type: 1, period: 1 });
payrollPaymentSchema.index({ category: 1, level: 1, session: 1, period: 1 });

module.exports = mongoose.model("PayrollPayment", payrollPaymentSchema);
