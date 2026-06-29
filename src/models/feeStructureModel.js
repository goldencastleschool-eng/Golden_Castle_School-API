const mongoose = require("mongoose");
const { VALID_FEE_CATEGORIES } = require("../utils/feeCategories");

const feeStructureSchema = new mongoose.Schema(
  {
    class_record: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
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

    fee_category: {
      type: String,
      required: true,
      enum: VALID_FEE_CATEGORIES,
      default: "returning"
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

feeStructureSchema.index(
  { class_record: 1, session: 1, term: 1, fee_category: 1 },
  { unique: true }
);
feeStructureSchema.index(
  {
    session: "text",
    term: "text",
    fee_category: "text",
    "items.name": "text"
  },
  {
    name: "fee_structure_search_text",
    weights: {
      "items.name": 8,
      session: 4,
      term: 4,
      fee_category: 3
    }
  }
);

module.exports = mongoose.model("FeeStructure", feeStructureSchema);
