const Bus = require("../models/busModel");
const BusRoute = require("../models/busRouteModel");
const BusFeeStructure = require("../models/busFeeStructureModel");
const BusEnrollment = require("../models/busEnrollmentModel");
const BusPayment = require("../models/busPaymentModel");
const Class = require("../models/classModel");
const Student = require("../models/studentModel");
const {
  applyListQueryOptions,
  getListQueryOptions
} = require("../utils/listQueryOptions");
const {
  studentBelongsToTermClass
} = require("../utils/studentTermEnrollment");

const populateRoute = {
  path: "route",
  populate: {
    path: "bus",
    select: "name plate_number driver_name driver_phone capacity status"
  }
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
  populateRoute
];

const populatePayment = [
  {
    path: "student",
    select: "full_name admission_no"
  },
  populateRoute,
  {
    path: "enrollment",
    select: "class class_record pickup_point status",
    populate: {
      path: "class_record",
      select: "name session"
    }
  }
];

const validTerms = ["First Term", "Second Term", "Third Term"];

const normalizeText = (value = "") => value.toString().trim();

const normalizeLowerText = (value = "") => normalizeText(value).toLowerCase();

const normalizePickupPoints = (value = []) => {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  return value
    .toString()
    .split(/\r?\n|,/)
    .map(normalizeText)
    .filter(Boolean);
};

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

const getRecordId = (record) => record?._id || record || "";

const isActiveStudent = (student) =>
  !student.status || student.status === "active";

const buildReceiptNumber = (paymentId) =>
  `GCIS-BUS-${paymentId.toString().slice(-8).toUpperCase()}`;

const getBusPaymentQuery = (reqQuery = {}) => {
  const query = {};

  if (reqQuery.enrollment) {
    query.enrollment = reqQuery.enrollment;
  }

  if (reqQuery.student) {
    query.student = reqQuery.student;
  }

  if (reqQuery.route) {
    query.route = reqQuery.route;
  }

  if (reqQuery.session) {
    query.session = reqQuery.session;
  }

  if (reqQuery.term) {
    query.term = reqQuery.term;
  }

  return query;
};

const getBusEnrollmentQuery = (reqQuery = {}) => {
  const query = {};

  if (reqQuery.route) {
    query.route = reqQuery.route;
  }

  if (reqQuery.class_record) {
    query.class_record = reqQuery.class_record;
  }

  if (reqQuery.session) {
    query.session = reqQuery.session;
  }

  if (reqQuery.term) {
    query.term = reqQuery.term;
  }

  if (reqQuery.status) {
    query.status = reqQuery.status;
  }

  return query;
};

const getBuses = async (req, res) => {
  try {
    const busesQuery = Bus.find().sort({ createdAt: -1 });
    const buses = await applyListQueryOptions(
      busesQuery,
      getListQueryOptions(req.query)
    );

    res.json(buses);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createBus = async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const plateNumber = normalizeText(req.body.plate_number).toUpperCase();
    const capacity = Number(req.body.capacity || 0);

    if (!name) {
      return res.status(400).json({
        message: "Bus name is required"
      });
    }

    if (!Number.isFinite(capacity) || capacity < 0) {
      return res.status(400).json({
        message: "Bus capacity must be a valid number"
      });
    }

    const bus = await Bus.create({
      name,
      plate_number: plateNumber,
      driver_name: normalizeText(req.body.driver_name),
      driver_phone: normalizeText(req.body.driver_phone),
      capacity,
      status: req.body.status || "active"
    });

    res.status(201).json(bus);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Bus name already exists"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const updateBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found"
      });
    }

    const name = normalizeText(req.body.name);
    const capacity = Number(req.body.capacity || 0);

    if (!name) {
      return res.status(400).json({
        message: "Bus name is required"
      });
    }

    if (!Number.isFinite(capacity) || capacity < 0) {
      return res.status(400).json({
        message: "Bus capacity must be a valid number"
      });
    }

    bus.name = name;
    bus.plate_number = normalizeText(req.body.plate_number).toUpperCase();
    bus.driver_name = normalizeText(req.body.driver_name);
    bus.driver_phone = normalizeText(req.body.driver_phone);
    bus.capacity = capacity;
    bus.status = req.body.status || "active";

    await bus.save();

    res.json(bus);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Bus name already exists"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found"
      });
    }

    const routeCount = await BusRoute.countDocuments({ bus: bus._id });

    if (routeCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a bus that is assigned to a route"
      });
    }

    await bus.deleteOne();

    res.json({
      message: "Bus deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getRoutes = async (req, res) => {
  try {
    const routesQuery = BusRoute.find()
      .populate("bus", "name plate_number driver_name driver_phone capacity status")
      .sort({ createdAt: -1 });
    const routes = await applyListQueryOptions(
      routesQuery,
      getListQueryOptions(req.query)
    );

    res.json(routes);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createRoute = async (req, res) => {
  try {
    const name = normalizeText(req.body.name);

    if (!name) {
      return res.status(400).json({
        message: "Route name is required"
      });
    }

    const route = await BusRoute.create({
      name,
      bus: req.body.bus || null,
      pickup_points: normalizePickupPoints(req.body.pickup_points),
      status: req.body.status || "active"
    });
    const populatedRoute = await BusRoute.findById(route._id).populate(
      "bus",
      "name plate_number driver_name driver_phone capacity status"
    );

    res.status(201).json(populatedRoute);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Route name already exists"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const updateRoute = async (req, res) => {
  try {
    const route = await BusRoute.findById(req.params.id);

    if (!route) {
      return res.status(404).json({
        message: "Route not found"
      });
    }

    const name = normalizeText(req.body.name);

    if (!name) {
      return res.status(400).json({
        message: "Route name is required"
      });
    }

    route.name = name;
    route.bus = req.body.bus || null;
    route.pickup_points = normalizePickupPoints(req.body.pickup_points);
    route.status = req.body.status || "active";

    await route.save();

    const populatedRoute = await BusRoute.findById(route._id).populate(
      "bus",
      "name plate_number driver_name driver_phone capacity status"
    );

    res.json(populatedRoute);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Route name already exists"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const deleteRoute = async (req, res) => {
  try {
    const route = await BusRoute.findById(req.params.id);

    if (!route) {
      return res.status(404).json({
        message: "Route not found"
      });
    }

    const [enrollmentCount, structureCount] = await Promise.all([
      BusEnrollment.countDocuments({ route: route._id }),
      BusFeeStructure.countDocuments({ route: route._id })
    ]);

    if (enrollmentCount > 0 || structureCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a route with bus enrollments or fee structures"
      });
    }

    await route.deleteOne();

    res.json({
      message: "Route deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getFeeStructures = async (req, res) => {
  try {
    const query = {};

    if (req.query.route) {
      query.route = req.query.route;
    }

    if (req.query.session) {
      query.session = req.query.session;
    }

    if (req.query.term) {
      query.term = req.query.term;
    }

    const structuresQuery = BusFeeStructure.find(query)
      .populate(populateRoute)
      .sort({ session: -1, term: 1, createdAt: -1 });
    const structures = await applyListQueryOptions(
      structuresQuery,
      getListQueryOptions(req.query)
    );

    res.json(structures);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const saveFeeStructurePayload = async (payload, existingStructure = null) => {
  const routeId = payload.route;
  const session = normalizeText(payload.session);
  const term = payload.term;
  const items = normalizeItems(payload.items);
  const amount =
    items.length > 0
      ? items.reduce((sum, item) => sum + item.amount, 0)
      : Number(payload.amount);

  if (!routeId || !session || !term) {
    return {
      message: "Route, session, and term are required"
    };
  }

  if (!validTerms.includes(term)) {
    return {
      message: "A valid term is required"
    };
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      message: "Amount must be a valid number"
    };
  }

  const route = await BusRoute.findById(routeId);

  if (!route) {
    return {
      message: "Selected route was not found"
    };
  }

  if (items.length === 0) {
    return {
      message: "At least one fee item is required"
    };
  }

  if (existingStructure) {
    existingStructure.route = route._id;
    existingStructure.session = session;
    existingStructure.term = term;
    existingStructure.items = items;
    existingStructure.amount = amount;

    await existingStructure.save();

    return {
      structure: existingStructure
    };
  }

  const structure = await BusFeeStructure.create({
    route: route._id,
    session,
    term,
    items,
    amount
  });

  return {
    structure
  };
};

const createFeeStructure = async (req, res) => {
  try {
    const result = await saveFeeStructurePayload(req.body);

    if (result.message) {
      return res.status(400).json({
        message: result.message
      });
    }

    const populatedStructure = await BusFeeStructure.findById(
      result.structure._id
    ).populate(populateRoute);

    res.status(201).json(populatedStructure);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "A bus payment structure already exists for this route, session, and term"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const updateFeeStructure = async (req, res) => {
  try {
    const structure = await BusFeeStructure.findById(req.params.id);

    if (!structure) {
      return res.status(404).json({
        message: "Bus payment structure not found"
      });
    }

    const paymentCount = await BusPayment.countDocuments({
      route: structure.route,
      session: structure.session,
      term: structure.term
    });

    if (
      paymentCount > 0 &&
      (
        req.body.route?.toString() !== structure.route.toString() ||
        normalizeText(req.body.session) !== structure.session ||
        req.body.term !== structure.term
      )
    ) {
      return res.status(400).json({
        message:
          "This bus payment structure already has recorded payments. You can edit the fee items and amount, but cannot change its route, session, or term."
      });
    }

    const result = await saveFeeStructurePayload(req.body, structure);

    if (result.message) {
      return res.status(400).json({
        message: result.message
      });
    }

    if (paymentCount > 0) {
      await BusPayment.updateMany(
        {
          route: result.structure.route,
          session: result.structure.session,
          term: result.structure.term
        },
        {
          expected_amount_at_payment: result.structure.amount,
          expected_items_at_payment: result.structure.items
        }
      );
    }

    const populatedStructure = await BusFeeStructure.findById(
      result.structure._id
    ).populate(populateRoute);

    res.json(populatedStructure);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "A bus payment structure already exists for this route, session, and term"
      });
    }

    res.status(500).json({
      error: error.message
    });
  }
};

const deleteFeeStructure = async (req, res) => {
  try {
    const structure = await BusFeeStructure.findById(req.params.id);

    if (!structure) {
      return res.status(404).json({
        message: "Bus payment structure not found"
      });
    }

    const paymentCount = await BusPayment.countDocuments({
      route: structure.route,
      session: structure.session,
      term: structure.term
    });

    if (paymentCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a bus payment structure with recorded payments"
      });
    }

    await structure.deleteOne();

    res.json({
      message: "Bus payment structure deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getEnrollments = async (req, res) => {
  try {
    const enrollmentQuery = getBusEnrollmentQuery(req.query);
    const enrollmentsQuery = BusEnrollment.find(enrollmentQuery)
      .populate(populateEnrollment)
      .sort({ createdAt: -1 });
    const listOptions = getListQueryOptions(req.query);
    const [enrollments, totalCount] = await Promise.all([
      applyListQueryOptions(enrollmentsQuery, listOptions),
      BusEnrollment.countDocuments(enrollmentQuery)
    ]);

    res.set("X-Total-Count", totalCount.toString());

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createEnrollments = async (req, res) => {
  try {
    const {
      student_ids: studentIds = [],
      class_record,
      route,
      pickup_point,
      session,
      term
    } = req.body;

    const selectedStudentIds = Array.isArray(studentIds)
      ? studentIds.filter(Boolean)
      : [];

    if (
      selectedStudentIds.length === 0 ||
      !class_record ||
      !route ||
      !session ||
      !term
    ) {
      return res.status(400).json({
        message: "Students, class, route, session, and term are required"
      });
    }

    if (!validTerms.includes(term)) {
      return res.status(400).json({
        message: "A valid term is required"
      });
    }

    const [classRecord, routeRecord, students] = await Promise.all([
      Class.findById(class_record),
      BusRoute.findById(route),
      Student.find({ _id: { $in: selectedStudentIds } })
        .populate("fee_enrollments.class_record")
    ]);

    if (!classRecord) {
      return res.status(404).json({
        message: "Selected class was not found"
      });
    }

    if (!routeRecord) {
      return res.status(404).json({
        message: "Selected route was not found"
      });
    }

    const eligibleStudents = students.filter((student) =>
      isActiveStudent(student) &&
      studentBelongsToTermClass({
        student,
        classRecord,
        session,
        term
      })
    );

    if (eligibleStudents.length === 0) {
      return res.status(400).json({
        message: "No selected active student belongs to this class for the selected session and term"
      });
    }

    const existingEnrollments = await BusEnrollment.find({
      student: { $in: eligibleStudents.map((student) => student._id) },
      session,
      term
    }).select("student");
    const existingStudentIds = new Set(
      existingEnrollments.map((enrollment) => enrollment.student.toString())
    );
    const newEnrollments = eligibleStudents
      .filter((student) => !existingStudentIds.has(student._id.toString()))
      .map((student) => ({
        student: student._id,
        class_record: classRecord._id,
        class: classRecord.name,
        route: routeRecord._id,
        pickup_point: normalizeText(pickup_point),
        session,
        term,
        status: "active"
      }));

    if (newEnrollments.length > 0) {
      await BusEnrollment.insertMany(newEnrollments, {
        ordered: false
      });
    }

    const savedEnrollments = await BusEnrollment.find({
      student: { $in: eligibleStudents.map((student) => student._id) },
      session,
      term
    })
      .populate(populateEnrollment)
      .sort({ createdAt: -1 });

    res.status(201).json({
      message:
        `${newEnrollments.length} student(s) enrolled for bus transport. ` +
        `${existingStudentIds.size} selected student(s) already had bus enrollment for this term.`,
      createdCount: newEnrollments.length,
      skippedCount: existingStudentIds.size,
      enrollments: savedEnrollments
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateEnrollment = async (req, res) => {
  try {
    const enrollment = await BusEnrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        message: "Bus enrollment not found"
      });
    }

    if (req.body.route) {
      const route = await BusRoute.findById(req.body.route);

      if (!route) {
        return res.status(404).json({
          message: "Selected route was not found"
        });
      }

      enrollment.route = route._id;
    }

    enrollment.pickup_point = normalizeText(req.body.pickup_point);
    enrollment.status = req.body.status || enrollment.status;
    enrollment.stop_reason =
      enrollment.status === "active" ? "" : normalizeText(req.body.stop_reason);
    enrollment.stopped_at =
      enrollment.status === "active" ? null : enrollment.stopped_at || new Date();

    await enrollment.save();

    const populatedEnrollment = await BusEnrollment.findById(enrollment._id)
      .populate(populateEnrollment);

    res.json(populatedEnrollment);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await BusEnrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        message: "Bus enrollment not found"
      });
    }

    const paymentCount = await BusPayment.countDocuments({
      enrollment: enrollment._id
    });

    if (paymentCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a bus enrollment with recorded payments"
      });
    }

    await enrollment.deleteOne();

    res.json({
      message: "Bus enrollment deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getPayments = async (req, res) => {
  try {
    const paymentQuery = getBusPaymentQuery(req.query);
    const paymentsQuery = BusPayment.find(paymentQuery)
      .populate(populatePayment)
      .sort({ payment_date: -1, createdAt: -1 });
    const listOptions = getListQueryOptions(req.query);
    const [payments, totalCount] = await Promise.all([
      applyListQueryOptions(paymentsQuery, listOptions),
      BusPayment.countDocuments(paymentQuery)
    ]);

    res.set("X-Total-Count", totalCount.toString());

    res.json(payments);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getEnrollmentPaid = async (enrollmentId, excludedPaymentId = "") => {
  const query = {
    enrollment: enrollmentId
  };

  if (excludedPaymentId) {
    query._id = {
      $ne: excludedPaymentId
    };
  }

  const payments = await BusPayment.find(query).select("amount");

  return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
};

const buildPaymentSnapshot = async (payload, excludedPaymentId = "") => {
  const enrollment = await BusEnrollment.findById(payload.enrollment)
    .populate("student", "full_name admission_no")
    .populate(populateRoute);

  if (!enrollment) {
    return {
      message: "Selected bus enrollment was not found"
    };
  }

  if (enrollment.status !== "active") {
    return {
      message: "Bus payment can only be recorded for active bus enrollments"
    };
  }

  const structure = await BusFeeStructure.findOne({
    route: enrollment.route._id || enrollment.route,
    session: enrollment.session,
    term: enrollment.term
  });

  if (!structure) {
    return {
      message:
        "Create a bus payment structure for this route, session, and term before recording payment"
    };
  }

  const amount = Number(payload.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      message: "Amount must be a valid number"
    };
  }

  if (Number.isNaN(new Date(payload.payment_date).getTime())) {
    return {
      message: "Payment date is invalid"
    };
  }

  const alreadyPaid = await getEnrollmentPaid(enrollment._id, excludedPaymentId);
  const expectedAmount = Number(structure.amount || 0);
  const balance = Math.max(expectedAmount - alreadyPaid, 0);

  if (amount > balance) {
    return {
      message:
        `Payment amount cannot be greater than the outstanding bus balance. ` +
        `Expected total is ${expectedAmount}, already paid is ${alreadyPaid}, and remaining balance is ${balance}.`
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
      return res.status(400).json({
        message: snapshot.message
      });
    }

    const payment = new BusPayment({
      enrollment: snapshot.enrollment._id,
      student: snapshot.enrollment.student._id || snapshot.enrollment.student,
      route: snapshot.enrollment.route._id || snapshot.enrollment.route,
      session: snapshot.enrollment.session,
      term: snapshot.enrollment.term,
      expected_amount_at_payment: snapshot.structure.amount,
      expected_items_at_payment: snapshot.structure.items,
      amount: snapshot.amount,
      payment_date: new Date(req.body.payment_date),
      payment_method: normalizeText(req.body.payment_method),
      note: normalizeText(req.body.note)
    });

    payment.receipt_no = buildReceiptNumber(payment._id);
    await payment.save();

    const populatedPayment = await BusPayment.findById(payment._id)
      .populate(populatePayment);

    res.status(201).json(populatedPayment);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updatePayment = async (req, res) => {
  try {
    const payment = await BusPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Bus payment record not found"
      });
    }

    const snapshot = await buildPaymentSnapshot(req.body, payment._id);

    if (snapshot.message) {
      return res.status(400).json({
        message: snapshot.message
      });
    }

    payment.enrollment = snapshot.enrollment._id;
    payment.student = snapshot.enrollment.student._id || snapshot.enrollment.student;
    payment.route = snapshot.enrollment.route._id || snapshot.enrollment.route;
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

    const populatedPayment = await BusPayment.findById(payment._id)
      .populate(populatePayment);

    res.json(populatedPayment);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const deletePayment = async (req, res) => {
  try {
    const payment = await BusPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Bus payment record not found"
      });
    }

    await payment.deleteOne();

    res.json({
      message: "Bus payment deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getBuses,
  createBus,
  updateBus,
  deleteBus,
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
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
