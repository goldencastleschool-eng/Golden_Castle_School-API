const mongoose = require("mongoose");

const payrollStaffSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true,
      trim: true
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

    job_title: {
      type: String,
      trim: true,
      default: ""
    },

    phone: {
      type: String,
      trim: true,
      default: ""
    },

    employment_date: {
      type: Date,
      default: null
    },

    linked_teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null
    },

    status: {
      type: String,
      enum: ["active", "inactive", "resigned", "suspended"],
      default: "active"
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

payrollStaffSchema.index({ category: 1, level: 1, status: 1 });
payrollStaffSchema.index({ full_name: "text", job_title: "text", phone: "text" });

module.exports = mongoose.model("PayrollStaff", payrollStaffSchema);
