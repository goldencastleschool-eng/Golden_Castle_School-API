const FeeStructure = require("../models/feeStructureModel");
const Class = require("../models/classModel");

const populateClass = {
  path: "class_record",
  select: "name session"
};

const validateFeeStructurePayload = async (payload) => {
  const classRecordId = payload.class_record;
  const session = payload.session?.trim();
  const term = payload.term;
  const amount = Number(payload.amount);

  if (!classRecordId || !session || !term || payload.amount === undefined) {
    return {
      message: "Class, session, term, and amount are required"
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
    amount
  };
};

const getFeeStructures = async (req, res) => {
  try {
    const feeStructures = await FeeStructure.find()
      .populate(populateClass)
      .sort({
        session: -1,
        term: 1
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
      amount: validation.amount
    });

    const populatedFeeStructure = await FeeStructure.findById(feeStructure._id)
      .populate(populateClass);

    res.status(201).json(populatedFeeStructure);

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Fee structure already exists for this class, session, and term"
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
    feeStructure.amount = validation.amount;

    await feeStructure.save();

    const updatedFeeStructure = await FeeStructure.findById(feeStructure._id)
      .populate(populateClass);

    res.json(updatedFeeStructure);

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Fee structure already exists for this class, session, and term"
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
  updateFeeStructure,
  deleteFeeStructure
};
