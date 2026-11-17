const FeeSectionTemplate = require("../models/feeSectionTemplateModel");
const FeeStructure = require("../models/feeStructureModel");
const Class = require("../models/classModel");
const Fee = require("../models/feeModel");
const { VALID_FEE_CATEGORIES, normalizeFeeCategory } = require("../utils/feeCategories");
const { VALID_FEE_SECTIONS, getFeeSectionForClass } = require("../utils/feeSections");

const normaliseItems = (items) => Array.isArray(items)
  ? items.map((item) => ({ name: item.name?.toString().trim() || "", amount: Number(item.amount) }))
  : [];

const validatePayload = (payload) => {
  const section = payload.section?.trim();
  const session = payload.session?.trim();
  const term = payload.term;
  const feeCategory = normalizeFeeCategory(payload.fee_category);
  const items = normaliseItems(payload.items);
  if (!VALID_FEE_SECTIONS.includes(section) || !session || !["First Term", "Second Term", "Third Term"].includes(term) || !VALID_FEE_CATEGORIES.includes(feeCategory)) {
    return { message: "A valid section, session, term, and learner category are required." };
  }
  if (!items.length || items.some((item) => !item.name || !Number.isFinite(item.amount) || item.amount < 0)) {
    return { message: "Add at least one fee item with a valid non-negative amount." };
  }
  return { section, session, term, feeCategory, items, amount: items.reduce((sum, item) => sum + item.amount, 0) };
};

const getTemplates = async (req, res) => {
  try {
    const query = {};
    if (req.query.session) query.session = req.query.session.trim();
    const templates = await FeeSectionTemplate.find(query).sort({ session: -1, section: 1, term: 1, fee_category: 1 });
    res.json(templates);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const saveTemplate = async (req, res) => {
  try {
    const validation = validatePayload(req.body);
    if (validation.message) return res.status(400).json(validation);
    const template = await FeeSectionTemplate.findOneAndUpdate(
      { section: validation.section, session: validation.session, term: validation.term, fee_category: validation.feeCategory },
      { $set: { items: validation.items, amount: validation.amount } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(template);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const publishTemplate = async (req, res) => {
  try {
    const template = await FeeSectionTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: "Fee section template was not found." });
    const classes = await Class.find({ session: template.session });
    const matchingClasses = classes.filter((classRecord) => getFeeSectionForClass(classRecord) === template.section);
    const created = [], updated = [], skipped = [];
    for (const classRecord of matchingClasses) {
      const key = { class_record: classRecord._id, session: template.session, term: template.term, fee_category: template.fee_category };
      const structure = await FeeStructure.findOne(key);
      if (!structure) {
        await FeeStructure.create({ ...key, items: template.items, amount: template.amount });
        created.push(classRecord.name);
        continue;
      }
      const paymentCount = await Fee.countDocuments(key);
      if (paymentCount) { skipped.push(classRecord.name); continue; }
      structure.items = template.items;
      structure.amount = template.amount;
      await structure.save();
      updated.push(classRecord.name);
    }
    template.last_published_at = new Date();
    await template.save();
    res.json({ message: "Template published.", created, updated, skipped, unmatched_class_count: classes.length - matchingClasses.length });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = { getTemplates, saveTemplate, publishTemplate };
