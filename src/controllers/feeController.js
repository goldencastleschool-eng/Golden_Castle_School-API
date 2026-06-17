const Fee = require("../models/feeModel");
const Student = require("../models/studentModel");
const FeeStructure = require("../models/feeStructureModel");
const {
  applyListQueryOptions,
  getListQueryOptions
} = require("../utils/listQueryOptions");

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

const validFeeTerms = ["First Term", "Second Term", "Third Term"];

const getTermIndex = (term = "") => {
  const termIndex = validFeeTerms.indexOf(term);

  return termIndex === -1 ? validFeeTerms.length : termIndex;
};

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

const getStudentEffectiveFeeEnrollment = (student, session, term) => {
  const enrollments = Array.isArray(student.fee_enrollments)
    ? student.fee_enrollments
    : [];
  const targetTermIndex = getTermIndex(term);

  return enrollments
    .filter(
      (enrollment) =>
        enrollment.session === session &&
        getTermIndex(enrollment.term) <= targetTermIndex
    )
    .sort(
      (firstEnrollment, secondEnrollment) =>
        getTermIndex(secondEnrollment.term) - getTermIndex(firstEnrollment.term)
    )[0];
};

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(Number(amount || 0));

const buildReceiptNumber = (feeId) =>
  `GCIS-RCPT-${feeId.toString().slice(-8).toUpperCase()}`;

const getRecordId = (record) => record?._id || record || "";

const getFeeCategoryForStudentTerm = (student, session, term) =>
  getStudentFeeEnrollment(student, session, term)?.fee_category || "returning";

const buildStudentFeeKey = ({ session, term, feeCategory }) =>
  [session, term, feeCategory].join("|");

const getStudentFeeClassRecordId = (student, session, term) => {
  const enrollment = getStudentEffectiveFeeEnrollment(student, session, term);

  return (
    enrollment?.class_record ||
    student.class_record?._id ||
    student.class_record
  );
};

const getStudentFeeClassName = (student, session, term) => {
  const enrollment = getStudentEffectiveFeeEnrollment(student, session, term);

  return (
    enrollment?.class ||
    student.class_record?.name ||
    student.class ||
    ""
  );
};

const getStudentPaidForTerm = async ({
  student,
  session,
  term,
  excludedFeeId = ""
}) => {
  const query = {
    student,
    session,
    term
  };

  if (excludedFeeId) {
    query._id = {
      $ne: excludedFeeId
    };
  }

  const payments = await Fee.find(query).select("amount");

  return payments.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
};

const buildFeeSnapshot = async (payload, excludedFeeId = "") => {
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

  const enrollment = getStudentEffectiveFeeEnrollment(
    selectedStudent,
    session,
    term
  );
  const exactEnrollment = getStudentFeeEnrollment(selectedStudent, session, term);
  const feeCategory = exactEnrollment?.fee_category || "returning";
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

  const alreadyPaid = await getStudentPaidForTerm({
    student,
    session,
    term,
    excludedFeeId
  });
  const expectedAmount = Number(feeStructure.amount || 0);
  const remainingBalance = Math.max(expectedAmount - alreadyPaid, 0);

  if (numericAmount > remainingBalance) {
    return {
      message:
        `Payment amount cannot be greater than the outstanding balance. ` +
        `Expected total is ${formatAmount(expectedAmount)}, already paid is ${formatAmount(alreadyPaid)}, and remaining balance is ${formatAmount(remainingBalance)}.`
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
    amount: numericAmount,
    alreadyPaid,
    remainingBalance,
    projectedPaid: alreadyPaid + numericAmount
  };
};

const getFees = async (req, res) => {
  try {
    const query = {};

    if (req.query.student) {
      query.student = req.query.student;
    }

    if (req.query.class_record) {
      query.class_record = req.query.class_record;
    }

    if (req.query.session) {
      query.session = req.query.session;
    }

    if (req.query.term) {
      query.term = req.query.term;
    }

    const feesQuery = Fee.find(query)
      .populate(populateFee)
      .sort({
        payment_date: -1,
        createdAt: -1
      });
    const fees = await applyListQueryOptions(
      feesQuery,
      getListQueryOptions(req.query)
    );

    res.json(fees);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getMyFees = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .select("-password")
      .populate("class_record")
      .populate("fee_enrollments.class_record");

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const studentClassRecordId = getRecordId(student.class_record);
    const [studentPayments, currentClassStructures] = await Promise.all([
      Fee.find({
        student: student._id
      })
        .populate(populateFee)
        .sort({
          payment_date: -1,
          createdAt: -1
        }),
      studentClassRecordId
        ? FeeStructure.find({
            class_record: studentClassRecordId,
            session: student.current_session
          }).sort({
            term: 1,
            fee_category: 1
          })
        : []
    ]);

    const summaryMap = new Map();

    const addSummarySeed = ({
      session,
      term,
      feeCategory,
      classRecordId,
      className
    }) => {
      if (!session || !term || !feeCategory) {
        return;
      }

      const key = buildStudentFeeKey({
        session,
        term,
        feeCategory
      });

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          session,
          term,
          fee_category: feeCategory,
          class_record: classRecordId,
          class: className
        });
      }
    };

    student.fee_enrollments.forEach((enrollment) => {
      addSummarySeed({
        session: enrollment.session,
        term: enrollment.term,
        feeCategory: enrollment.fee_category || "returning",
        classRecordId: getRecordId(enrollment.class_record),
        className: enrollment.class || enrollment.class_record?.name || ""
      });
    });

    currentClassStructures.forEach((feeStructure) => {
      const feeCategory = getFeeCategoryForStudentTerm(
        student,
        feeStructure.session,
        feeStructure.term
      );

      if ((feeStructure.fee_category || "returning") !== feeCategory) {
        return;
      }

      addSummarySeed({
        session: feeStructure.session,
        term: feeStructure.term,
        feeCategory,
        classRecordId: getRecordId(feeStructure.class_record),
        className: student.class_record?.name || student.class || ""
      });
    });

    studentPayments.forEach((fee) => {
      addSummarySeed({
        session: fee.session,
        term: fee.term,
        feeCategory: fee.fee_category || "returning",
        classRecordId: getRecordId(fee.class_record),
        className: fee.class || fee.class_record?.name || student.class || ""
      });
    });

    if (summaryMap.size === 0 && student.current_session) {
      validFeeTerms.forEach((term) => {
        addSummarySeed({
          session: student.current_session,
          term,
          feeCategory: getFeeCategoryForStudentTerm(
            student,
            student.current_session,
            term
          ),
          classRecordId: studentClassRecordId,
          className: student.class_record?.name || student.class || ""
        });
      });
    }

    const summaries = await Promise.all(
      Array.from(summaryMap.values()).map(async (seed) => {
        const feeStructure = seed.class_record
          ? await FeeStructure.findOne({
              class_record: seed.class_record,
              session: seed.session,
              term: seed.term,
              fee_category: seed.fee_category
            })
          : null;
        const payments = studentPayments.filter(
          (fee) =>
            fee.session === seed.session &&
            fee.term === seed.term &&
            (fee.fee_category || "returning") === seed.fee_category
        );
        const totalPaid = payments.reduce(
          (sum, fee) => sum + Number(fee.amount || 0),
          0
        );
        const expectedAmount = Number(
          feeStructure?.amount ||
            payments[0]?.expected_amount_at_payment ||
            0
        );
        const balance = Math.max(expectedAmount - totalPaid, 0);
        const status =
          expectedAmount <= 0 && totalPaid <= 0
            ? "No Structure"
            : totalPaid <= 0
              ? "Unpaid"
              : balance > 0
                ? "Part Payment"
                : "Fully Paid";

        return {
          session: seed.session,
          term: seed.term,
          class_record: seed.class_record,
          class: seed.class || getStudentFeeClassName(student, seed.session, seed.term),
          fee_category: seed.fee_category,
          expected_amount: expectedAmount,
          expected_items:
            feeStructure?.items ||
            payments[0]?.expected_items_at_payment ||
            [],
          total_paid: totalPaid,
          balance,
          status,
          payments: payments.map((fee) => ({
            _id: fee._id,
            student: fee.student,
            class_record: fee.class_record,
            class: fee.class,
            session: fee.session,
            term: fee.term,
            fee_category: fee.fee_category,
            expected_amount_at_payment:
              fee.expected_amount_at_payment || expectedAmount,
            expected_items_at_payment:
              fee.expected_items_at_payment ||
              feeStructure?.items ||
              [],
            amount: fee.amount,
            payment_date: fee.payment_date,
            payment_method: fee.payment_method,
            receipt_no: fee.receipt_no || buildReceiptNumber(fee._id),
            note: fee.note
          }))
        };
      })
    );

    summaries.sort((firstSummary, secondSummary) => {
      const sessionCompare = secondSummary.session.localeCompare(
        firstSummary.session
      );

      if (sessionCompare !== 0) {
        return sessionCompare;
      }

      return (
        validFeeTerms.indexOf(firstSummary.term) -
        validFeeTerms.indexOf(secondSummary.term)
      );
    });

    res.json({
      student: {
        _id: student._id,
        full_name: student.full_name,
        admission_no: student.admission_no,
        class: student.class,
        class_record: student.class_record,
        current_session: student.current_session
      },
      summaries
    });

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

    const fee = new Fee({
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
      receipt_no: "",
      note: req.body.note || ""
    });

    fee.receipt_no = buildReceiptNumber(fee._id);
    await fee.save();

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

    const snapshot = await buildFeeSnapshot(req.body, fee._id);

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
    fee.receipt_no = buildReceiptNumber(fee._id);
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
  getMyFees,
  createFee,
  updateFee,
  deleteFee
};
