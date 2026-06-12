const FeeStructure = require("../models/feeStructureModel");
const Class = require("../models/classModel");
const Fee = require("../models/feeModel");
const { ensureFeeStructureIndexes } = require("../utils/feeStructureIndexes");

const populateClass = {
  path: "class_record",
  select: "name session"
};

const validFeeCategories = ["new", "returning"];

const normalizeFeeCategory = (feeCategory = "") =>
  feeCategory.toString().trim().toLowerCase();

const formatFeeCategoryLabel = (feeCategory = "") => {
  const normalizedCategory = normalizeFeeCategory(feeCategory);

  if (normalizedCategory === "new") {
    return "Newly admitted";
  }

  if (normalizedCategory === "returning") {
    return "Returning/old";
  }

  return "Selected";
};

const isLegacyDuplicateIndexError = (error) => {
  const keyFields = Object.keys(error.keyPattern || {});

  return (
    error.code === 11000 &&
    keyFields.includes("class_record") &&
    keyFields.includes("session") &&
    keyFields.includes("term") &&
    !keyFields.includes("fee_category")
  );
};

const getDuplicateFeeStructureMessage = (feeCategory) =>
  `A payment structure for ${formatFeeCategoryLabel(feeCategory).toLowerCase()} students already exists for this class, session, and term. Use Edit to change it.`;

const legacyFeeStructureIndexMessage =
  "The database still has an old payment-structure index that allows only one structure per class, session, and term. Restart or redeploy the backend so it can rebuild the index, then create the payment structure again.";

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

const findExistingFeeStructure = (validation, excludedId = "") => {
  const query = {
    class_record: validation.classRecord._id,
    session: validation.session,
    term: validation.term,
    fee_category: validation.feeCategory
  };

  if (excludedId) {
    query._id = {
      $ne: excludedId
    };
  }

  return FeeStructure.findOne(query);
};

const getRecordId = (record) => record?._id || record || "";

const buildFeeQueryForStructure = (feeStructure) => ({
  class_record: getRecordId(feeStructure.class_record),
  session: feeStructure.session,
  term: feeStructure.term,
  fee_category: feeStructure.fee_category || "returning"
});

const buildFeeQueryForValidation = (validation) => ({
  class_record: validation.classRecord._id,
  session: validation.session,
  term: validation.term,
  fee_category: validation.feeCategory
});

const hasSameStructureKey = (feeStructure, validation) =>
  getRecordId(feeStructure.class_record).toString() ===
    validation.classRecord._id.toString() &&
  feeStructure.session === validation.session &&
  feeStructure.term === validation.term &&
  (feeStructure.fee_category || "returning") === validation.feeCategory;

const findOverpaidStudentForStructure = async (feeQuery, expectedAmount) => {
  const [overpaidStudent] = await Fee.aggregate([
    {
      $match: feeQuery
    },
    {
      $group: {
        _id: "$student",
        paid: {
          $sum: "$amount"
        }
      }
    },
    {
      $match: {
        paid: {
          $gt: expectedAmount
        }
      }
    },
    {
      $limit: 1
    }
  ]);

  return overpaidStudent;
};

const validateStructureUpdateAgainstFees = async (feeStructure, validation) => {
  const feeQuery = buildFeeQueryForStructure(feeStructure);
  const recordedFeeCount = await Fee.countDocuments(feeQuery);

  if (recordedFeeCount === 0) {
    return {
      feeQuery,
      recordedFeeCount
    };
  }

  if (!hasSameStructureKey(feeStructure, validation)) {
    return {
      message:
        "This payment structure already has recorded fee payments. You can edit the fee items and amount, but cannot change its class, session, term, or student category.",
      feeQuery,
      recordedFeeCount
    };
  }

  const overpaidStudent = await findOverpaidStudentForStructure(
    feeQuery,
    validation.amount
  );

  if (overpaidStudent) {
    return {
      message:
        `This payment structure cannot be reduced to ${validation.amount} because at least one student has already paid ${overpaidStudent.paid}.`,
      feeQuery,
      recordedFeeCount
    };
  }

  return {
    feeQuery,
    recordedFeeCount
  };
};

const syncRecordedFeesToStructure = (feeQuery, validation) =>
  Fee.updateMany(
    feeQuery,
    {
      $set: {
        expected_amount_at_payment: validation.amount,
        expected_items_at_payment: validation.items
      }
    }
  );

const resolveDuplicateFeeStructureMessage = async (validation, error) => {
  if (!validation?.classRecord) {
    return isLegacyDuplicateIndexError(error)
      ? legacyFeeStructureIndexMessage
      : "Fee structure already exists";
  }

  const existingSameCategory = await findExistingFeeStructure(validation);

  if (existingSameCategory) {
    return getDuplicateFeeStructureMessage(validation.feeCategory);
  }

  const existingAnyCategory = await FeeStructure.findOne({
    class_record: validation.classRecord._id,
    session: validation.session,
    term: validation.term
  });

  if (existingAnyCategory || isLegacyDuplicateIndexError(error)) {
    return legacyFeeStructureIndexMessage;
  }

  return getDuplicateFeeStructureMessage(validation.feeCategory);
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
  let validation;

  try {
    await ensureFeeStructureIndexes();

    validation = await validateFeeStructurePayload(req.body);

    if (validation.message) {
      return res.status(400).json({
        message: validation.message
      });
    }

    const existingFeeStructure = await findExistingFeeStructure(validation);

    if (existingFeeStructure) {
      return res.status(400).json({
        message: getDuplicateFeeStructureMessage(validation.feeCategory)
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
      const message = await resolveDuplicateFeeStructureMessage(
        validation,
        error
      );

      return res.status(400).json({
        message
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const upsertBothFeeStructures = async (req, res) => {
  let activeValidation;

  try {
    await ensureFeeStructureIndexes();

    const categories = req.body.fee_category
      ? [
          {
            fee_category: req.body.fee_category,
            items: req.body.items
          }
        ]
      : [
          Array.isArray(req.body.new_items) && {
            fee_category: "new",
            items: req.body.new_items
          },
          Array.isArray(req.body.returning_items) && {
            fee_category: "returning",
            items: req.body.returning_items
          }
        ].filter(Boolean);

    if (categories.length === 0) {
      return res.status(400).json({
        message: "Select at least one student category and fee item list"
      });
    }

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
          message: `${formatFeeCategoryLabel(categoryPayload.fee_category)} structure: ${validation.message}`
        });
      }

      validations.push(validation);
    }

    const savedStructures = [];

    for (const validation of validations) {
      activeValidation = validation;
      const existingFeeStructure = await FeeStructure.findOne(
        buildFeeQueryForValidation(validation)
      );
      const linkedFeeResult = existingFeeStructure
        ? await validateStructureUpdateAgainstFees(
            existingFeeStructure,
            validation
          )
        : {
            feeQuery: buildFeeQueryForValidation(validation),
            recordedFeeCount: 0
          };

      if (linkedFeeResult.message) {
        return res.status(400).json({
          message: linkedFeeResult.message
        });
      }

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

      if (linkedFeeResult.recordedFeeCount > 0) {
        await syncRecordedFeesToStructure(linkedFeeResult.feeQuery, validation);
      }

      savedStructures.push(feeStructure);
    }

    res.status(200).json({
      message:
        savedStructures.length === 1
          ? `Payment structure saved for ${formatFeeCategoryLabel(savedStructures[0].fee_category)} students`
          : "Payment structures saved for newly admitted and returning students",
      feeStructures: savedStructures
    });

  } catch (error) {
    if (error.code === 11000) {
      const message = await resolveDuplicateFeeStructureMessage(
        activeValidation,
        error
      );

      return res.status(400).json({
        message
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const updateFeeStructure = async (req, res) => {
  let validation;

  try {
    await ensureFeeStructureIndexes();

    const feeStructure = await FeeStructure.findById(req.params.id);

    if (!feeStructure) {
      return res.status(404).json({
        message: "Fee structure not found"
      });
    }

    validation = await validateFeeStructurePayload(req.body);

    if (validation.message) {
      return res.status(400).json({
        message: validation.message
      });
    }

    const existingFeeStructure = await findExistingFeeStructure(
      validation,
      feeStructure._id
    );

    if (existingFeeStructure) {
      return res.status(400).json({
        message: getDuplicateFeeStructureMessage(validation.feeCategory)
      });
    }

    const linkedFeeResult = await validateStructureUpdateAgainstFees(
      feeStructure,
      validation
    );

    if (linkedFeeResult.message) {
      return res.status(400).json({
        message: linkedFeeResult.message
      });
    }

    feeStructure.class_record = validation.classRecord._id;
    feeStructure.session = validation.session;
    feeStructure.term = validation.term;
    feeStructure.fee_category = validation.feeCategory;
    feeStructure.items = validation.items;
    feeStructure.amount = validation.amount;

    await feeStructure.save();

    if (linkedFeeResult.recordedFeeCount > 0) {
      await syncRecordedFeesToStructure(linkedFeeResult.feeQuery, validation);
    }

    const updatedFeeStructure = await FeeStructure.findById(feeStructure._id)
      .populate(populateClass);

    res.json(updatedFeeStructure);

  } catch (error) {
    if (error.code === 11000) {
      const message = await resolveDuplicateFeeStructureMessage(
        validation,
        error
      );

      return res.status(400).json({
        message
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

    const recordedFeeCount = await Fee.countDocuments(
      buildFeeQueryForStructure(feeStructure)
    );

    if (recordedFeeCount > 0) {
      return res.status(400).json({
        message:
          `Cannot delete this payment structure because ${recordedFeeCount} fee payment record(s) are linked to it. Delete or correct those fee payments first.`
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
