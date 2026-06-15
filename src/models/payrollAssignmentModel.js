const mongoose = require("mongoose");

const payrollAssignmentSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollStaff",
      required: true
    },

    structure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollStructure",
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

    gross_amount: {
      type: Number,
      required: true,
      min: 0
    },

    deduction_amount: {
      type: Number,
      required: true,
      min: 0
    },

    net_amount: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: ["active", "paused", "cancelled"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

payrollAssignmentSchema.index(
  { staff: 1, session: 1, period_type: 1, period: 1 },
  { unique: true }
);
payrollAssignmentSchema.index({ category: 1, level: 1, session: 1, period: 1 });

module.exports = mongoose.model("PayrollAssignment", payrollAssignmentSchema);
