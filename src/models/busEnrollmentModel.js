const mongoose = require("mongoose");
const {
  VALID_BUS_PAYMENT_CATEGORIES
} = require("../utils/busPaymentCategories");

const busEnrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },

    class: {
      type: String,
      required: true,
      trim: true
    },

    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusRoute",
      required: true
    },

    pickup_point: {
      type: String,
      trim: true,
      default: ""
    },

    payment_category: {
      type: String,
      enum: VALID_BUS_PAYMENT_CATEGORIES,
      default: "both"
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

    status: {
      type: String,
      enum: ["active", "stopped", "transferred"],
      default: "active"
    },

    stopped_at: {
      type: Date,
      default: null
    },

    stop_reason: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

busEnrollmentSchema.index(
  { student: 1, session: 1, term: 1 },
  { unique: true }
);
busEnrollmentSchema.index({ class_record: 1, session: 1, term: 1, status: 1 });
busEnrollmentSchema.index({ route: 1, session: 1, term: 1, status: 1 });

module.exports = mongoose.model("BusEnrollment", busEnrollmentSchema);
