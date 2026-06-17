const mongoose = require("mongoose");

const boardingFeeStructureSchema = new mongoose.Schema(
  {
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoardingHouse",
      required: true
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
    items: [
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
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

boardingFeeStructureSchema.index(
  { house: 1, session: 1, term: 1 },
  { unique: true }
);
boardingFeeStructureSchema.index({ session: 1, term: 1 });

module.exports = mongoose.model(
  "BoardingFeeStructure",
  boardingFeeStructureSchema
);
