const mongoose = require("mongoose");

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
  { class_record: 1, session: 1, term: 1 },
  { unique: true }
);

module.exports = mongoose.model("FeeStructure", feeStructureSchema);
