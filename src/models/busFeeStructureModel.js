const mongoose = require("mongoose");
const {
  VALID_BUS_PAYMENT_CATEGORIES
} = require("../utils/busPaymentCategories");

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

    payment_category: {
      type: String,
      enum: VALID_BUS_PAYMENT_CATEGORIES,
      default: "both"
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
  { route: 1, session: 1, term: 1, payment_category: 1 },
  { unique: true }
);
busFeeStructureSchema.index({ session: 1, term: 1 });

module.exports = mongoose.model("BusFeeStructure", busFeeStructureSchema);
