const Fee = require("../models/feeModel");
const Student = require("../models/studentModel");

const populateStudent = {
  path: "student",
  select: "full_name admission_no class current_session status"
};

const validateFeePayload = async (payload) => {
  const {
    student,
    session,
    term,
    amount,
    payment_date
  } = payload;

  if (!student || !session || !term || amount === undefined || !payment_date) {
    return "Student, session, term, amount, and payment date are required";
  }

  const selectedStudent = await Student.findById(student).select("_id");

  if (!selectedStudent) {
    return "Selected student was not found";
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return "Amount must be a valid number";
  }

  if (Number.isNaN(new Date(payment_date).getTime())) {
    return "Payment date is invalid";
  }

  return "";
};

const getFees = async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate(populateStudent)
      .sort({
        payment_date: -1,
        createdAt: -1
      });

    res.json(fees);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createFee = async (req, res) => {
  try {
    const validationMessage = await validateFeePayload(req.body);

    if (validationMessage) {
      return res.status(400).json({
        message: validationMessage
      });
    }

    const fee = await Fee.create({
      student: req.body.student,
      session: req.body.session,
      term: req.body.term,
      amount: Number(req.body.amount),
      payment_date: new Date(req.body.payment_date),
      payment_method: req.body.payment_method || "",
      receipt_no: req.body.receipt_no || "",
      note: req.body.note || ""
    });

    const populatedFee = await Fee.findById(fee._id).populate(populateStudent);

    res.status(201).json(populatedFee);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateFee = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        message: "Fee payment record not found"
      });
    }

    const validationMessage = await validateFeePayload(req.body);

    if (validationMessage) {
      return res.status(400).json({
        message: validationMessage
      });
    }

    fee.student = req.body.student;
    fee.session = req.body.session;
    fee.term = req.body.term;
    fee.amount = Number(req.body.amount);
    fee.payment_date = new Date(req.body.payment_date);
    fee.payment_method = req.body.payment_method || "";
    fee.receipt_no = req.body.receipt_no || "";
    fee.note = req.body.note || "";

    await fee.save();

    const updatedFee = await Fee.findById(fee._id).populate(populateStudent);

    res.json(updatedFee);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const deleteFee = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        message: "Fee payment record not found"
      });
    }

    await fee.deleteOne();

    res.json({
      message: "Fee payment record deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getFees,
  createFee,
  updateFee,
  deleteFee
};
