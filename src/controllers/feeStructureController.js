const FeeStructure = require("../models/feeStructureModel");
const Class = require("../models/classModel");

const populateClass = {
  path: "class_record",
  select: "name session"
};

const validFeeCategories = ["new", "returning"];

const normalizeFeeCategory = (feeCategory = "") =>
  feeCategory.toString().trim().toLowerCase();

const normalizeItems = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      name: item.name?.toString().trim() || "",
      amount: Number(item.amount)
    }))
    .filter((item) => item.name && Number.isFinite(item.amount) && item.amount >= 0);
};

const validateRawItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "At least one fee item is required";
  }

  const hasInvalidItem = items.some((item) => {
    const name = item.name?.toString().trim() || "";
    const amount = Number(item.amount);

    return !name || !Number.isFinite(amount) || amount < 0;
  });

  return hasInvalidItem
    ? "Each fee item must have a name and a valid amount"
    : "";
};

const validateFeeStructurePayload = async (payload) => {
  const classRecordId = payload.class_record;
  const session = payload.session?.trim();
  const term = payload.term;
  const feeCategory = normalizeFeeCategory(payload.fee_category);
  const itemValidationMessage = validateRawItems(payload.items);
  const items = normalizeItems(payload.items);
  const amount = items.length > 0
    ? items.reduce((sum, item) => sum + item.amount, 0)
    : Number(payload.amount);

  if (
    !classRecordId ||
    !session ||
    !term ||
    !feeCategory ||
    itemValidationMessage
  ) {
    return {
      message:
        itemValidationMessage ||
        "Class, session, term, fee category, and fee items are required"
    };
  }

  if (!validFeeCategories.includes(feeCategory)) {
    return {
      message: "Fee category must be new or returning"
    };
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      message: "Amount must be a valid number"
    };
  }

  const classRecord = await Class.findById(classRecordId);

  if (!classRecord) {
    return {
      message: "Selected class was not found"
    };
  }

  if (classRecord.session !== session) {
    return {
      message: "Selected class must belong to the selected session"
    };
  }

  return {
    classRecord,
    session,
    term,
    feeCategory,
    items,
    amount
  };
};

const getFeeStructures = async (req, res) => {
  try {
    const feeStructures = await FeeStructure.find()
      .populate(populateClass)
      .sort({
        session: -1,
        term: 1,
        fee_category: 1
      });

    res.json(feeStructures);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createFeeStructure = async (req, res) => {
  try {
    const validation = await validateFeeStructurePayload(req.body);

    if (validation.message) {
      return res.status(400).json({
        message: validation.message
      });
    }

    const feeStructure = await FeeStructure.create({
      class_record: validation.classRecord._id,
      session: validation.session,
      term: validation.term,
      fee_category: validation.feeCategory,
      items: validation.items,
      amount: validation.amount
    });

    const populatedFeeStructure = await FeeStructure.findById(feeStructure._id)
      .populate(populateClass);

    res.status(201).json(populatedFeeStructure);

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Fee structure already exists for this class, session, term, and fee category"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const upsertBothFeeStructures = async (req, res) => {
  try {
    const categories = [
      {
        fee_category: "new",
        items: req.body.new_items
      },
      {
        fee_category: "returning",
        items: req.body.returning_items
      }
    ];

    const validations = [];

    for (const categoryPayload of categories) {
      const validation = await validateFeeStructurePayload({
        class_record: req.body.class_record,
        session: req.body.session,
        term: req.body.term,
        fee_category: categoryPayload.fee_category,
        items: categoryPayload.items
      });

      if (validation.message) {
        return res.status(400).json({
          message: `${categoryPayload.fee_category === "new" ? "Newly admitted" : "Returning/old"} structure: ${validation.message}`
        });
      }

      validations.push(validation);
    }

    const savedStructures = [];

    for (const validation of validations) {
      const feeStructure = await FeeStructure.findOneAndUpdate(
        {
          class_record: validation.classRecord._id,
          session: validation.session,
          term: validation.term,
          fee_category: validation.feeCategory
        },
        {
          class_record: validation.classRecord._id,
          session: validation.session,
          term: validation.term,
          fee_category: validation.feeCategory,
          items: validation.items,
          amount: validation.amount
        },
        {
          new: true,
          runValidators: true,
          upsert: true
        }
      ).populate(populateClass);

      savedStructures.push(feeStructure);
    }

    res.status(200).json({
      message: "Payment structures saved for newly admitted and returning students",
      feeStructures: savedStructures
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Fee structure already exists for this class, session, term, and fee category"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const updateFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findById(req.params.id);

    if (!feeStructure) {
      return res.status(404).json({
        message: "Fee structure not found"
      });
    }

    const validation = await validateFeeStructurePayload(req.body);

    if (validation.message) {
      return res.status(400).json({
        message: validation.message
      });
    }

    feeStructure.class_record = validation.classRecord._id;
    feeStructure.session = validation.session;
    feeStructure.term = validation.term;
    feeStructure.fee_category = validation.feeCategory;
    feeStructure.items = validation.items;
    feeStructure.amount = validation.amount;

    await feeStructure.save();

    const updatedFeeStructure = await FeeStructure.findById(feeStructure._id)
      .populate(populateClass);

    res.json(updatedFeeStructure);

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Fee structure already exists for this class, session, term, and fee category"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const deleteFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findById(req.params.id);

    if (!feeStructure) {
      return res.status(404).json({
        message: "Fee structure not found"
      });
    }

    await feeStructure.deleteOne();

    res.json({
      message: "Fee structure deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getFeeStructures,
  createFeeStructure,
  upsertBothFeeStructures,
  updateFeeStructure,
  deleteFeeStructure
};
