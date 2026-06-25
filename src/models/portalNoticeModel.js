const mongoose = require("mongoose");

const portalNoticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    portal: {
      type: String,
      enum: ["student", "teacher", "both"],
      default: "both"
    },

    is_active: {
      type: Boolean,
      default: true
    },

    starts_at: {
      type: Date,
      default: null
    },

    ends_at: {
      type: Date,
      default: null
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    },

    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    }
  },
  {
    timestamps: true
  }
);

portalNoticeSchema.index({ is_active: 1, portal: 1, createdAt: -1 });

module.exports = mongoose.model("PortalNotice", portalNoticeSchema);
