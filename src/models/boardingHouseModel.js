const mongoose = require("mongoose");

const boardingHouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Mixed", ""],
      default: ""
    },
    capacity: {
      type: Number,
      min: 0,
      default: 0
    },
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

boardingHouseSchema.index({ status: 1, name: 1 });

module.exports = mongoose.model("BoardingHouse", boardingHouseSchema);
