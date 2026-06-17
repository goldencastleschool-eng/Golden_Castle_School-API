const BoardingHouse = require("../models/boardingHouseModel");
const BoardingFeeStructure = require("../models/boardingFeeStructureModel");
const BoardingEnrollment = require("../models/boardingEnrollmentModel");
const BoardingPayment = require("../models/boardingPaymentModel");
const Class = require("../models/classModel");
const Student = require("../models/studentModel");
const {
  applyListQueryOptions,
  getListQueryOptions
} = require("../utils/listQueryOptions");
const {
  studentBelongsToTermClass
} = require("../utils/studentTermEnrollment");

const populateHouse = {
  path: "house",
  select: "name gender capacity status"
};

const populateEnrollment = [
  {
    path: "student",
    select: "full_name admission_no gender status"
  },
  {
    path: "class_record",
    select: "name session"
  },
  populateHouse
];

const populatePayment = [
  {
    path: "student",
    select: "full_name admission_no"
  },
  populateHouse,
  {
    path: "enrollment",
    select: "class class_record status",
    populate: {
      path: "class_record",
      select: "name session"
    }
  }
];

const validTerms = ["First Term", "Second Term", "Third Term"];

const normalizeText = (value = "") => value.toString().trim();

const normalizeItems = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      name: normalizeText(item.name),
      amount: Number(item.amount)
    }))
    .filter((item) => item.name && Number.isFinite(item.amount) && item.amount >= 0);
};

const buildReceiptNumber = (paymentId) =>
  `GCIS-BOARD-${paymentId.toString().slice(-8).toUpperCase()}`;

const getRecordId = (record) => record?._id || record || "";

const isActiveStudent = (student) =>
  !student.status || student.status === "active";

const getEnrollmentQuery = (reqQuery = {}) => {
  const query = {};

  if (reqQuery.house) query.house = reqQuery.house;
  if (reqQuery.class_record) query.class_record = reqQuery.class_record;
  if (reqQuery.session) query.session = reqQuery.session;
  if (reqQuery.term) query.term = reqQuery.term;
  if (reqQuery.status) query.status = reqQuery.status;

  return query;
};

const getPaymentQuery = (reqQuery = {}) => {
  const query = {};

  if (reqQuery.enrollment) query.enrollment = reqQuery.enrollment;
  if (reqQuery.student) query.student = reqQuery.student;
  if (reqQuery.house) query.house = reqQuery.house;
  if (reqQuery.session) query.session = reqQuery.session;
  if (reqQuery.term) query.term = reqQuery.term;

  return query;
};

const getHouses = async (req, res) => {
  try {
    const housesQuery = BoardingHouse.find().sort({ createdAt: -1 });
    const houses = await applyListQueryOptions(
      housesQuery,
      getListQueryOptions(req.query)
    );

    res.json(houses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createHouse = async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const capacity = Number(req.body.capacity || 0);

    if (!name) {
      return res.status(400).json({ message: "Boarding house name is required" });
    }

    if (!Number.isFinite(capacity) || capacity < 0) {
      return res.status(400).json({ message: "Capacity must be a valid number" });
    }

    const house = await BoardingHouse.create({
      name,
      gender: req.body.gender || "",
      capacity,
      status: req.body.status || "active"
    });

    res.status(201).json(house);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Boarding house already exists" });
    }

    res.status(500).json({ error: error.message });
  }
};

const updateHouse = async (req, res) => {
  try {
    const house = await BoardingHouse.findById(req.params.id);

    if (!house) {
      return res.status(404).json({ message: "Boarding house not found" });
    }

    const name = normalizeText(req.body.name);
    const capacity = Number(req.body.capacity || 0);

    if (!name) {
      return res.status(400).json({ message: "Boarding house name is required" });
    }

    if (!Number.isFinite(capacity) || capacity < 0) {
      return res.status(400).json({ message: "Capacity must be a valid number" });
    }

    house.name = name;
    house.gender = req.body.gender || "";
    house.capacity = capacity;
    house.status = req.body.status || house.status;

    await house.save();
    res.json(house);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Boarding house already exists" });
    }

    res.status(500).json({ error: error.message });
  }
};

const deleteHouse = async (req, res) => {
  try {
    const house = await BoardingHouse.findById(req.params.id);

    if (!house) {
      return res.status(404).json({ message: "Boarding house not found" });
    }

    const linkedCount = await Promise.all([
      BoardingFeeStructure.countDocuments({ house: house._id }),
      BoardingEnrollment.countDocuments({ house: house._id }),
      BoardingPayment.countDocuments({ house: house._id })
    ]);

    if (linkedCount.some((count) => count > 0)) {
      return res.status(400).json({
        message: "Cannot delete a boarding house with linked records"
      });
    }

    await house.deleteOne();
    res.json({ message: "Boarding house deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFeeStructures = async (req, res) => {
  try {
    const query = {};
    if (req.query.house) query.house = req.query.house;
    if (req.query.session) query.session = req.query.session;
    if (req.query.term) query.term = req.query.term;

    const structuresQuery = BoardingFeeStructure.find(query)
      .populate(populateHouse)
      .sort({ createdAt: -1 });
    const structures = await applyListQueryOptions(
      structuresQuery,
      getListQueryOptions(req.query)
    );

    res.json(structures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createFeeStructure = async (req, res) => {
  try {
    const house = req.body.house;
    const session = normalizeText(req.body.session);
    const term = req.body.term;
    const items = normalizeItems(req.body.items);

    if (!house || !session || !validTerms.includes(term) || items.length === 0) {
      return res.status(400).json({
        message: "House, session, term, and at least one payment item are required"
      });
    }

    const structure = await BoardingFeeStructure.create({
      house,
      session,
      term,
      items,
      amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    });

    const populatedStructure = await BoardingFeeStructure.findById(structure._id)
      .populate(populateHouse);

    res.status(201).json(populatedStructure);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "A boarding payment structure already exists for this house, session, and term"
      });
    }

    res.status(500).json({ error: error.message });
  }
};

const updateFeeStructure = async (req, res) => {
  try {
    const structure = await BoardingFeeStructure.findById(req.params.id);

    if (!structure) {
      return res.status(404).json({ message: "Boarding payment structure not found" });
    }

    const items = normalizeItems(req.body.items);

    if (items.length === 0) {
      return res.status(400).json({
        message: "At least one payment item is required"
      });
    }

    structure.items = items;
    structure.amount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    await structure.save();

    const populatedStructure = await BoardingFeeStructure.findById(structure._id)
      .populate(populateHouse);

    res.json(populatedStructure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteFeeStructure = async (req, res) => {
  try {
    const structure = await BoardingFeeStructure.findById(req.params.id);

    if (!structure) {
      return res.status(404).json({ message: "Boarding payment structure not found" });
    }

    const paymentCount = await BoardingPayment.countDocuments({
      house: structure.house,
      session: structure.session,
      term: structure.term
    });

    if (paymentCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a boarding payment structure with recorded payments"
      });
    }

    await structure.deleteOne();
    res.json({ message: "Boarding payment structure deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEnrollments = async (req, res) => {
  try {
    const query = getEnrollmentQuery(req.query);
    const total = await BoardingEnrollment.countDocuments(query);
    const enrollmentsQuery = BoardingEnrollment.find(query)
      .populate(populateEnrollment)
      .sort({ createdAt: -1 });
    const enrollments = await applyListQueryOptions(
      enrollmentsQuery,
      getListQueryOptions(req.query)
    );

    res.set("X-Total-Count", total);
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createEnrollments = async (req, res) => {
  try {
    const session = normalizeText(req.body.session);
    const term = req.body.term;
    const classRecordId = req.body.class_record;
    const house = req.body.house;
    const studentIds = Array.isArray(req.body.student_ids)
      ? req.body.student_ids
      : [];

    if (!session || !validTerms.includes(term) || !classRecordId || !house) {
      return res.status(400).json({
        message: "Class, house, session, and term are required"
      });
    }

    if (studentIds.length === 0) {
      return res.status(400).json({ message: "Select at least one student" });
    }

    const classRecord = await Class.findById(classRecordId);

    if (!classRecord) {
      return res.status(404).json({ message: "Class record not found" });
    }

    const students = await Student.find({ _id: { $in: studentIds } });
    const validStudents = students.filter(
      (student) =>
        isActiveStudent(student) &&
        studentBelongsToTermClass(student, classRecord, session, term)
    );
    const existingEnrollments = await BoardingEnrollment.find({
      student: { $in: validStudents.map((student) => student._id) },
      session,
      term
    });
    const existingStudentIds = new Set(
      existingEnrollments.map((enrollment) => enrollment.student.toString())
    );
    const newEnrollments = validStudents
      .filter((student) => !existingStudentIds.has(student._id.toString()))
      .map((student) => ({
        student: student._id,
        class_record: classRecord._id,
        class: classRecord.name,
        house,
        session,
        term,
        status: "active"
      }));

    if (newEnrollments.length > 0) {
      await BoardingEnrollment.insertMany(newEnrollments);
    }

    res.status(201).json({
      message:
        `${newEnrollments.length} student(s) registered for boarding. ` +
        `${existingStudentIds.size} selected student(s) already had boarding registration for this term.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateEnrollment = async (req, res) => {
  try {
    const enrollment = await BoardingEnrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({ message: "Boarding registration not found" });
    }

    enrollment.status = req.body.status || enrollment.status;
    enrollment.house = req.body.house || enrollment.house;

    await enrollment.save();

    const populatedEnrollment = await BoardingEnrollment.findById(enrollment._id)
      .populate(populateEnrollment);

    res.json(populatedEnrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await BoardingEnrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({ message: "Boarding registration not found" });
    }

    const paymentCount = await BoardingPayment.countDocuments({
      enrollment: enrollment._id
    });

    if (paymentCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a boarding registration with payment records"
      });
    }

    await enrollment.deleteOne();
    res.json({ message: "Boarding registration deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const query = getPaymentQuery(req.query);
    const total = await BoardingPayment.countDocuments(query);
    const paymentsQuery = BoardingPayment.find(query)
      .populate(populatePayment)
      .sort({ payment_date: -1, createdAt: -1 });
    const payments = await applyListQueryOptions(
      paymentsQuery,
      getListQueryOptions(req.query)
    );

    res.set("X-Total-Count", total);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const buildPaymentSnapshot = async (body = {}, paymentId = null) => {
  const enrollment = await BoardingEnrollment.findById(body.enrollment)
    .populate("student")
    .populate(populateHouse);

  if (!enrollment) {
    return { message: "Selected boarding registration was not found" };
  }

  if (enrollment.status !== "active") {
    return { message: "Boarding payment can only be recorded for active registrations" };
  }

  const structure = await BoardingFeeStructure.findOne({
    house: enrollment.house._id || enrollment.house,
    session: enrollment.session,
    term: enrollment.term
  });

  if (!structure) {
    return {
      message:
        "Create a boarding payment structure for this house, session, and term before recording payment"
    };
  }

  const amount = Number(body.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { message: "Payment amount must be greater than zero" };
  }

  const existingPayments = await BoardingPayment.find({
    enrollment: enrollment._id,
    ...(paymentId ? { _id: { $ne: paymentId } } : {})
  });
  const alreadyPaid = existingPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
  const outstanding = Math.max(Number(structure.amount || 0) - alreadyPaid, 0);

  if (amount > outstanding) {
    return {
      message:
        `Payment amount cannot be greater than the outstanding boarding balance. ` +
        `Outstanding balance is ${outstanding}.`
    };
  }

  return {
    enrollment,
    structure,
    amount
  };
};

const createPayment = async (req, res) => {
  try {
    const snapshot = await buildPaymentSnapshot(req.body);

    if (snapshot.message) {
      return res.status(400).json({ message: snapshot.message });
    }

    const payment = await BoardingPayment.create({
      enrollment: snapshot.enrollment._id,
      student: snapshot.enrollment.student._id || snapshot.enrollment.student,
      house: snapshot.enrollment.house._id || snapshot.enrollment.house,
      session: snapshot.enrollment.session,
      term: snapshot.enrollment.term,
      expected_amount_at_payment: snapshot.structure.amount,
      expected_items_at_payment: snapshot.structure.items,
      amount: snapshot.amount,
      payment_date: new Date(req.body.payment_date || Date.now()),
      payment_method: normalizeText(req.body.payment_method),
      note: normalizeText(req.body.note)
    });

    payment.receipt_no = buildReceiptNumber(payment._id);
    await payment.save();

    const populatedPayment = await BoardingPayment.findById(payment._id)
      .populate(populatePayment);

    res.status(201).json(populatedPayment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updatePayment = async (req, res) => {
  try {
    const payment = await BoardingPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Boarding payment record not found" });
    }

    const snapshot = await buildPaymentSnapshot(req.body, payment._id);

    if (snapshot.message) {
      return res.status(400).json({ message: snapshot.message });
    }

    payment.enrollment = snapshot.enrollment._id;
    payment.student = snapshot.enrollment.student._id || snapshot.enrollment.student;
    payment.house = snapshot.enrollment.house._id || snapshot.enrollment.house;
    payment.session = snapshot.enrollment.session;
    payment.term = snapshot.enrollment.term;
    payment.expected_amount_at_payment = snapshot.structure.amount;
    payment.expected_items_at_payment = snapshot.structure.items;
    payment.amount = snapshot.amount;
    payment.payment_date = new Date(req.body.payment_date);
    payment.payment_method = normalizeText(req.body.payment_method);
    payment.note = normalizeText(req.body.note);
    payment.receipt_no = buildReceiptNumber(payment._id);

    await payment.save();

    const populatedPayment = await BoardingPayment.findById(payment._id)
      .populate(populatePayment);

    res.json(populatedPayment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deletePayment = async (req, res) => {
  try {
    const payment = await BoardingPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Boarding payment record not found" });
    }

    await payment.deleteOne();
    res.json({ message: "Boarding payment deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getHouses,
  createHouse,
  updateHouse,
  deleteHouse,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getEnrollments,
  createEnrollments,
  updateEnrollment,
  deleteEnrollment,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment
};
