const mongoose = require("mongoose");

const portalNoticeAcknowledgementSchema = new mongoose.Schema(
  {
    notice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortalNotice",
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    user_role: {
      type: String,
      enum: ["student", "teacher"],
      required: true
    },

    acknowledged_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

portalNoticeAcknowledgementSchema.index(
  { notice: 1, user: 1, user_role: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "PortalNoticeAcknowledgement",
  portalNoticeAcknowledgementSchema
);
