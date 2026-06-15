const mongoose = require("mongoose");

const busFeeStructureSchema = new mongoose.Schema(
  {
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusRoute",
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

busFeeStructureSchema.index(
  { route: 1, session: 1, term: 1 },
  { unique: true }
);
busFeeStructureSchema.index({ session: 1, term: 1 });

module.exports = mongoose.model("BusFeeStructure", busFeeStructureSchema);
