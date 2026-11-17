const mongoose = require("mongoose");
const { VALID_FEE_CATEGORIES } = require("../utils/feeCategories");
const { VALID_FEE_SECTIONS } = require("../utils/feeSections");

const feeSectionTemplateSchema = new mongoose.Schema({
  section: { type: String, enum: VALID_FEE_SECTIONS, required: true },
  session: { type: String, required: true, trim: true },
  term: { type: String, enum: ["First Term", "Second Term", "Third Term"], required: true },
  fee_category: { type: String, enum: VALID_FEE_CATEGORIES, required: true },
  items: [{
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 }
  }],
  amount: { type: Number, required: true, min: 0 },
  last_published_at: { type: Date, default: null }
}, { timestamps: true });

feeSectionTemplateSchema.index(
  { section: 1, session: 1, term: 1, fee_category: 1 },
  { unique: true }
);

module.exports = mongoose.model("FeeSectionTemplate", feeSectionTemplateSchema);
