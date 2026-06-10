const Fee = require("../models/feeModel");
const Student = require("../models/studentModel");
const FeeStructure = require("../models/feeStructureModel");

const populateStudent = {
  path: "student",
  select: "full_name admission_no class class_record current_session status fee_enrollments",
  populate: {
    path: "fee_enrollments.class_record",
    select: "name session"
  }
};

const populateFee = [
  populateStudent,
  {
    path: "class_record",
    select: "name session"
  }
];

const getStudentFeeEnrollment = (student, session, term) => {
  const enrollments = Array.isArray(student.fee_enrollments)
    ? student.fee_enrollments
    : [];

  return enrollments.find(
    (enrollment) =>
      enrollment.session === session &&
      enrollment.term === term
  );
};

const buildFeeSnapshot = async (payload) => {
  const {
    student,
    session,
    term,
    amount,
    payment_date
  } = payload;

  if (!student || !session || !term || amount === undefined || !payment_date) {
    return {
      message: "Student, session, term, amount, and payment date are required"
    };
  }

  const selectedStudent = await Student.findById(student)
    .select("_id class class_record current_session fee_enrollments")
    .populate("class_record");

  if (!selectedStudent) {
    return {
      message: "Selected student was not found"
    };
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return {
      message: "Amount must be a valid number"
    };
  }

  if (Number.isNaN(new Date(payment_date).getTime())) {
    return {
      message: "Payment date is invalid"
    };
  }

  const enrollment = getStudentFeeEnrollment(selectedStudent, session, term);
  const feeCategory = enrollment?.fee_category || "returning";
  const classRecordId =
    enrollment?.class_record ||
    selectedStudent.class_record?._id ||
    selectedStudent.class_record;

  if (!classRecordId) {
    return {
      message: "Student class record is required before recording payment"
    };
  }

  const feeStructure = await FeeStructure.findOne({
    class_record: classRecordId,
    session,
    term,
    fee_category: feeCategory
  });

  if (!feeStructure) {
    return {
      message:
        "Create a matching payment structure for this class, session, term, and student category before recording payment"
    };
  }

  return {
    selectedStudent,
    feeCategory,
    feeStructure,
    classRecordId,
    className:
      enrollment?.class ||
      selectedStudent.class_record?.name ||
      selectedStudent.class ||
      "",
    amount: numericAmount
  };
};

const getFees = async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate(populateFee)
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
    const snapshot = await buildFeeSnapshot(req.body);

    if (snapshot.message) {
      return res.status(400).json({
        message: snapshot.message
      });
    }

    const fee = await Fee.create({
      student: req.body.student,
      class_record: snapshot.classRecordId,
      class: snapshot.className,
      session: req.body.session,
      term: req.body.term,
      fee_category: snapshot.feeCategory,
      expected_amount_at_payment: snapshot.feeStructure.amount,
      expected_items_at_payment: snapshot.feeStructure.items || [],
      amount: snapshot.amount,
      payment_date: new Date(req.body.payment_date),
      payment_method: req.body.payment_method || "",
      receipt_no: req.body.receipt_no || "",
      note: req.body.note || ""
    });

    const populatedFee = await Fee.findById(fee._id).populate(populateFee);

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

    const snapshot = await buildFeeSnapshot(req.body);

    if (snapshot.message) {
      return res.status(400).json({
        message: snapshot.message
      });
    }

    fee.student = req.body.student;
    fee.class_record = snapshot.classRecordId;
    fee.class = snapshot.className;
    fee.session = req.body.session;
    fee.term = req.body.term;
    fee.fee_category = snapshot.feeCategory;
    fee.expected_amount_at_payment = snapshot.feeStructure.amount;
    fee.expected_items_at_payment = snapshot.feeStructure.items || [];
    fee.amount = snapshot.amount;
    fee.payment_date = new Date(req.body.payment_date);
    fee.payment_method = req.body.payment_method || "";
    fee.receipt_no = req.body.receipt_no || "";
    fee.note = req.body.note || "";

    await fee.save();

    const updatedFee = await Fee.findById(fee._id).populate(populateFee);

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
