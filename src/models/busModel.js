const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    plate_number: {
      type: String,
      trim: true,
      default: ""
    },

    driver_name: {
      type: String,
      trim: true,
      default: ""
    },

    driver_phone: {
      type: String,
      trim: true,
      default: ""
    },

    capacity: {
      type: Number,
      min: 0,
      default: 0
    },

    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

busSchema.index({ name: 1 }, { unique: true });
busSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Bus", busSchema);
