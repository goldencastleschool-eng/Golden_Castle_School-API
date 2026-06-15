const mongoose = require("mongoose");

const payrollStructureSchema = new mongoose.Schema(
  {
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffLevel",
      required: true
    },

    category: {
      type: String,
      required: true,
      enum: ["academic", "non_academic"]
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

    earnings: [
      {
        name: {
          type: String,
          required: true,
          trim: true
        },
        amount: {
          type: Number,
          required: true,
          min: 0
        }
      }
    ],

    deductions: [
      {
        name: {
          type: String,
          required: true,
          trim: true
        },
        amount: {
          type: Number,
          required: true,
          min: 0
        }
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
    }
  },
  {
    timestamps: true
  }
);

payrollStructureSchema.index(
  { level: 1, session: 1, period_type: 1, period: 1 },
  { unique: true }
);
payrollStructureSchema.index({ category: 1, session: 1, period_type: 1, period: 1 });

module.exports = mongoose.model("PayrollStructure", payrollStructureSchema);
