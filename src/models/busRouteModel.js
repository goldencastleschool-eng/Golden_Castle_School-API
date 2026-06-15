const mongoose = require("mongoose");

const busRouteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      default: null
    },

    pickup_points: [
      {
        type: String,
        trim: true
      }
    ],

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

busRouteSchema.index({ name: 1 }, { unique: true });
busRouteSchema.index({ bus: 1, status: 1 });

module.exports = mongoose.model("BusRoute", busRouteSchema);
