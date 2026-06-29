const Class = require("../models/classModel");
const Bus = require("../models/busModel");
const BusEnrollment = require("../models/busEnrollmentModel");
const BusFeeStructure = require("../models/busFeeStructureModel");
const BusPayment = require("../models/busPaymentModel");
const BusRoute = require("../models/busRouteModel");
const BoardingEnrollment = require("../models/boardingEnrollmentModel");
const BoardingFeeStructure = require("../models/boardingFeeStructureModel");
const BoardingHouse = require("../models/boardingHouseModel");
const BoardingPayment = require("../models/boardingPaymentModel");
const Fee = require("../models/feeModel");
const FeeStructure = require("../models/feeStructureModel");
const PayrollAssignment = require("../models/payrollAssignmentModel");
const PayrollPayment = require("../models/payrollPaymentModel");
const PayrollStaff = require("../models/payrollStaffModel");
const Student = require("../models/studentModel");
const {
  formatBusPaymentCategoryLabel,
  normalizeBusPaymentCategory
} = require("../utils/busPaymentCategories");

const validTerms = ["First Term", "Second Term", "Third Term"];

const normalizeValue = (value = "") => value.toString().trim();

const normalizeClassName = (className = "") =>
  normalizeValue(className).toLowerCase().replace(/\s+/g, "");

const getRecordId = (record) => record?._id?.toString?.() || record?.toString?.() || "";

const getBusStructureKey = (routeId, paymentCategory = "both") =>
  `${routeId || "no-route"}|${normalizeBusPaymentCategory(paymentCategory)}`;

const isActiveStudent = (student) =>
  !student.status || student.status === "active";

const parseSessionStart = (session = "") => {
  const [startYear] = session.toString().split("/");
  const parsedYear = Number(startYear);

  return Number.isFinite(parsedYear) ? parsedYear : 0;
};

const sortSessions = (sessions = []) =>
  [...new Set(sessions.filter(Boolean).map(normalizeValue))]
    .filter(Boolean)
    .sort((firstSession, secondSession) => {
      const startDifference =
        parseSessionStart(secondSession) - parseSessionStart(firstSession);

      return startDifference || secondSession.localeCompare(firstSession);
    });

const getAvailableSessions = async () => {
  const [
    classSessions,
    studentSessions,
    feeEnrollmentSessions,
    feeSessions,
    feeStructureSessions
  ] = await Promise.all([
    Class.distinct("session"),
    Student.distinct("current_session"),
    Student.distinct("fee_enrollments.session"),
    Fee.distinct("session"),
    FeeStructure.distinct("session")
  ]);

  return sortSessions([
    ...classSessions,
    ...studentSessions,
    ...feeEnrollmentSessions,
    ...feeSessions,
    ...feeStructureSessions
  ]);
};

const getStudentEnrollment = (student, session, term) => {
  const enrollments = Array.isArray(student.fee_enrollments)
    ? student.fee_enrollments
    : [];

  return enrollments.find(
    (enrollment) => enrollment.session === session && enrollment.term === term
  );
};

const getStudentClassSnapshot = (student, enrollment, session) => {
  const enrollmentClassRecord = enrollment?.class_record;
  const studentClassRecord = student.class_record;
  const classRecord = enrollmentClassRecord || studentClassRecord;
  const className =
    enrollment?.class ||
    enrollmentClassRecord?.name ||
    studentClassRecord?.name ||
    student.class ||
    "";

  return {
    class_record: getRecordId(classRecord),
    class: className,
    session: enrollment?.session || student.current_session || session
  };
};

const getStructureKey = (classRecordId, feeCategory) =>
  `${classRecordId || "no-class"}|${feeCategory || "returning"}`;

const buildStudentReportRows = ({
  students,
  classesById,
  feesByStudentId,
  structuresByClassAndCategory,
  session,
  term,
  selectedClassId
}) => {
  return students
    .filter(isActiveStudent)
    .map((student) => {
      const enrollment = getStudentEnrollment(student, session, term);
      const isCurrentSessionStudent = student.current_session === session;

      if (!enrollment && !isCurrentSessionStudent) {
        return null;
      }

      const feeCategory = enrollment?.fee_category || "returning";
      const classSnapshot = getStudentClassSnapshot(student, enrollment, session);
      const classRecord =
        classesById.get(classSnapshot.class_record) ||
        student.class_record ||
        enrollment?.class_record ||
        null;
      const classRecordId = getRecordId(classRecord) || classSnapshot.class_record;
      const className =
        classRecord?.name ||
        classSnapshot.class ||
        student.class ||
        "Unassigned";

      if (selectedClassId && classRecordId !== selectedClassId) {
        return null;
      }

      const paid =
        feesByStudentId.get(`${getRecordId(student._id)}|${feeCategory}`) || 0;
      const structure = structuresByClassAndCategory.get(
        getStructureKey(classRecordId, feeCategory)
      );
      const expected = feeCategory === "vip" ? 0 : Number(structure?.amount || 0);
      const balance = Math.max(expected - paid, 0);
      const paymentStatus =
        feeCategory === "vip"
          ? "Exempt"
          : expected <= 0 && paid <= 0
            ? "No Structure"
            : paid <= 0
              ? "Unpaid"
              : balance > 0
                ? "Part Payment"
                : "Fully Paid";

      return {
        _id: getRecordId(student._id),
        full_name: student.full_name,
        admission_no: student.admission_no,
        gender: student.gender || "",
        class_record: classRecordId,
        class: className,
        session,
        term,
        fee_category: feeCategory,
        expected,
        paid,
        balance,
        payment_status: paymentStatus,
        createdAt: student.createdAt
      };
    })
    .filter(Boolean)
    .sort((firstStudent, secondStudent) => {
      const classCompare = normalizeClassName(firstStudent.class).localeCompare(
        normalizeClassName(secondStudent.class)
      );

      return (
        classCompare ||
        (firstStudent.full_name || "").localeCompare(secondStudent.full_name || "")
      );
    });
};

const buildClassSummaries = ({ classes, studentRows, selectedClassId }) => {
  const summariesByClass = new Map();

  classes.forEach((classRecord) => {
    const classRecordId = getRecordId(classRecord._id);

    if (selectedClassId && classRecordId !== selectedClassId) {
      return;
    }

    summariesByClass.set(classRecordId, {
      class_record: classRecordId,
      class: classRecord.name,
      session: classRecord.session,
      total_students: 0,
      newly_admitted: 0,
      returning: 0,
      exempt: 0,
      fee_category_counts: {},
      expected: 0,
      paid: 0,
      balance: 0,
      fully_paid: 0,
      part_payment: 0,
      unpaid: 0,
      no_structure: 0,
      outstanding_students: 0
    });
  });

  studentRows.forEach((student) => {
    const key = student.class_record || `class-name:${normalizeClassName(student.class)}`;

    if (!summariesByClass.has(key)) {
      summariesByClass.set(key, {
        class_record: student.class_record,
        class: student.class || "Unassigned",
        session: student.session,
        total_students: 0,
        newly_admitted: 0,
        returning: 0,
        exempt: 0,
        fee_category_counts: {},
        expected: 0,
        paid: 0,
        balance: 0,
        fully_paid: 0,
        part_payment: 0,
        unpaid: 0,
        no_structure: 0,
        outstanding_students: 0
      });
    }

    const summary = summariesByClass.get(key);

    summary.total_students += 1;
    summary.fee_category_counts[student.fee_category] =
      (summary.fee_category_counts[student.fee_category] || 0) + 1;
    summary.expected += student.expected;
    summary.paid += student.paid;
    summary.balance += student.balance;

    if (student.fee_category === "new") {
      summary.newly_admitted += 1;
    } else if (student.fee_category === "returning") {
      summary.returning += 1;
    }

    if (student.payment_status === "Exempt") {
      summary.exempt += 1;
    } else if (student.payment_status === "Fully Paid") {
      summary.fully_paid += 1;
    } else if (student.payment_status === "Part Payment") {
      summary.part_payment += 1;
      summary.outstanding_students += 1;
    } else if (student.payment_status === "Unpaid") {
      summary.unpaid += 1;
      summary.outstanding_students += 1;
    } else {
      summary.no_structure += 1;
    }
  });

  return Array.from(summariesByClass.values()).sort((firstClass, secondClass) =>
    normalizeClassName(firstClass.class).localeCompare(
      normalizeClassName(secondClass.class)
    )
  );
};

const sumRows = (rows, field) =>
  rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);

const buildBusSummary = ({
  buses = [],
  routes = [],
  structures = [],
  enrollments = [],
  payments = []
}) => {
  const routeById = new Map(
    routes.map((route) => [
      getRecordId(route._id),
      route
    ])
  );
  const structureByRouteAndCategory = new Map(
    structures.map((structure) => [
      getBusStructureKey(
        getRecordId(structure.route),
        structure.payment_category || "both"
      ),
      Number(structure.amount || 0)
    ])
  );
  const paidByEnrollmentId = payments.reduce((paymentMap, payment) => {
    const enrollmentId = getRecordId(payment.enrollment);
    paymentMap.set(
      enrollmentId,
      (paymentMap.get(enrollmentId) || 0) + Number(payment.amount || 0)
    );

    return paymentMap;
  }, new Map());

  const enrollmentRows = enrollments.map((enrollment) => {
    const routeId = getRecordId(enrollment.route);
    const paymentCategory = normalizeBusPaymentCategory(
      enrollment.payment_category || "both"
    );
    const expected =
      structureByRouteAndCategory.get(
        getBusStructureKey(routeId, paymentCategory)
      ) || 0;
    const paid = paidByEnrollmentId.get(getRecordId(enrollment._id)) || 0;
    const route = routeById.get(routeId);

    return {
      route_id: routeId,
      route: route?.name || enrollment.route?.name || enrollment.class || "Route not set",
      payment_category: paymentCategory,
      payment_category_label: formatBusPaymentCategoryLabel(paymentCategory),
      expected,
      paid,
      balance: Math.max(expected - paid, 0)
    };
  });
  const routeRows = Array.from(
    enrollmentRows.reduce((rowMap, enrollment) => {
      const routeId = enrollment.route_id || "no-route";
      const rowKey = getBusStructureKey(routeId, enrollment.payment_category);

      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          route_id: routeId,
          route: enrollment.route,
          payment_category: enrollment.payment_category,
          payment_category_label: enrollment.payment_category_label,
          active_enrollments: 0,
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_students: 0
        });
      }

      const row = rowMap.get(rowKey);
      row.active_enrollments += 1;
      row.expected += enrollment.expected;
      row.paid += enrollment.paid;
      row.balance += enrollment.balance;
      row.outstanding_students += enrollment.balance > 0 ? 1 : 0;

      return rowMap;
    }, new Map()).values()
  ).sort(
    (firstRow, secondRow) =>
      firstRow.route.localeCompare(secondRow.route) ||
      firstRow.payment_category_label.localeCompare(secondRow.payment_category_label)
  );

  return {
    registered_buses: buses.length,
    active_buses: buses.filter((bus) => bus.status === "active").length,
    routes: routes.length,
    active_enrollments: enrollments.length,
    expected: sumRows(enrollmentRows, "expected"),
    paid: sumRows(enrollmentRows, "paid"),
    balance: sumRows(enrollmentRows, "balance"),
    outstanding_students: enrollmentRows.filter((row) => row.balance > 0).length,
    payment_records: payments.length,
    route_rows: routeRows
  };
};

const buildPayrollSummary = ({
  staff = [],
  assignments = [],
  payments = []
}) => {
  const paidByAssignmentId = payments.reduce((paymentMap, payment) => {
    const assignmentId = getRecordId(payment.assignment);
    paymentMap.set(
      assignmentId,
      (paymentMap.get(assignmentId) || 0) + Number(payment.amount || 0)
    );

    return paymentMap;
  }, new Map());
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "active"
  );
  const assignmentRows = activeAssignments.map((assignment) => {
    const expected = Number(assignment.net_amount || 0);
    const paid = paidByAssignmentId.get(getRecordId(assignment._id)) || 0;

    return {
      category: assignment.category || "not_set",
      level_name: assignment.level_name || "Level not set",
      expected,
      paid,
      balance: Math.max(expected - paid, 0)
    };
  });
  const categoryRows = Array.from(
    assignmentRows.reduce((rowMap, assignment) => {
      const rowKey = `${assignment.category}|${assignment.level_name}`;

      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          key: rowKey,
          category: assignment.category,
          level_name: assignment.level_name,
          assigned_staff: 0,
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_staff: 0
        });
      }

      const row = rowMap.get(rowKey);
      row.assigned_staff += 1;
      row.expected += assignment.expected;
      row.paid += assignment.paid;
      row.balance += assignment.balance;
      row.outstanding_staff += assignment.balance > 0 ? 1 : 0;

      return rowMap;
    }, new Map()).values()
  ).sort(
    (firstRow, secondRow) =>
      firstRow.category.localeCompare(secondRow.category) ||
      firstRow.level_name.localeCompare(secondRow.level_name)
  );

  return {
    active_staff: staff.filter((staffRecord) => staffRecord.status === "active").length,
    assigned_staff: activeAssignments.length,
    expected: sumRows(assignmentRows, "expected"),
    paid: sumRows(assignmentRows, "paid"),
    balance: sumRows(assignmentRows, "balance"),
    outstanding_staff: assignmentRows.filter((row) => row.balance > 0).length,
    payment_records: payments.length,
    category_rows: categoryRows
  };
};

const buildBoardingSummary = ({
  houses = [],
  structures = [],
  enrollments = [],
  payments = []
}) => {
  const houseById = new Map(
    houses.map((house) => [getRecordId(house._id), house])
  );
  const structureByHouseId = new Map(
    structures.map((structure) => [
      getRecordId(structure.house),
      Number(structure.amount || 0)
    ])
  );
  const paidByEnrollmentId = payments.reduce((paymentMap, payment) => {
    const enrollmentId = getRecordId(payment.enrollment);
    paymentMap.set(
      enrollmentId,
      (paymentMap.get(enrollmentId) || 0) + Number(payment.amount || 0)
    );

    return paymentMap;
  }, new Map());
  const enrollmentRows = enrollments.map((enrollment) => {
    const houseId = getRecordId(enrollment.house);
    const expected = structureByHouseId.get(houseId) || 0;
    const paid = paidByEnrollmentId.get(getRecordId(enrollment._id)) || 0;
    const house = houseById.get(houseId);

    return {
      house_id: houseId,
      house: house?.name || "House not set",
      expected,
      paid,
      balance: Math.max(expected - paid, 0)
    };
  });
  const houseRows = Array.from(
    enrollmentRows.reduce((rowMap, enrollment) => {
      const houseId = enrollment.house_id || "no-house";

      if (!rowMap.has(houseId)) {
        rowMap.set(houseId, {
          house_id: houseId,
          house: enrollment.house,
          active_enrollments: 0,
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_students: 0
        });
      }

      const row = rowMap.get(houseId);
      row.active_enrollments += 1;
      row.expected += enrollment.expected;
      row.paid += enrollment.paid;
      row.balance += enrollment.balance;
      row.outstanding_students += enrollment.balance > 0 ? 1 : 0;

      return rowMap;
    }, new Map()).values()
  ).sort((firstRow, secondRow) => firstRow.house.localeCompare(secondRow.house));

  return {
    houses: houses.length,
    active_houses: houses.filter((house) => house.status === "active").length,
    active_enrollments: enrollments.length,
    expected: sumRows(enrollmentRows, "expected"),
    paid: sumRows(enrollmentRows, "paid"),
    balance: sumRows(enrollmentRows, "balance"),
    outstanding_students: enrollmentRows.filter((row) => row.balance > 0).length,
    payment_records: payments.length,
    house_rows: houseRows
  };
};

const getExecutiveReportOverview = async (req, res) => {
  try {
    const availableSessions = await getAvailableSessions();
    const requestedSession = normalizeValue(req.query.session);
    const session =
      requestedSession && availableSessions.includes(requestedSession)
        ? requestedSession
        : availableSessions[0] || "";
    const requestedTerm = normalizeValue(req.query.term);
    const term = validTerms.includes(requestedTerm)
      ? requestedTerm
      : validTerms[0];
    const selectedClassId = normalizeValue(req.query.class_record);

    if (!session) {
      res.set("Cache-Control", "no-store");
      return res.json({
        selected_session: "",
        selected_term: term,
        selected_class_record: selectedClassId,
        available_sessions: [],
        available_terms: validTerms,
        class_options: [],
        summary: {
          total_students: 0,
          newly_admitted: 0,
          returning: 0,
          exempt: 0,
          fee_category_counts: {},
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_students: 0
        },
        class_summaries: [],
        newly_admitted_students: [],
        returning_students: [],
        bus_summary: {
          registered_buses: 0,
          active_buses: 0,
          routes: 0,
          active_enrollments: 0,
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_students: 0,
          payment_records: 0,
          route_rows: []
        },
        payroll_summary: {
          active_staff: 0,
          assigned_staff: 0,
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_staff: 0,
          payment_records: 0,
          category_rows: []
        },
        boarding_summary: {
          houses: 0,
          active_houses: 0,
          active_enrollments: 0,
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_students: 0,
          payment_records: 0,
          house_rows: []
        }
      });
    }

    const [
      classes,
      feeStructures,
      fees,
      students,
      buses,
      busRoutes,
      busStructures,
      busEnrollments,
      busPayments,
      boardingHouses,
      boardingStructures,
      boardingEnrollments,
      boardingPayments,
      payrollStaff,
      payrollAssignments,
      payrollPayments
    ] = await Promise.all([
      Class.find({ session }).sort({ name: 1 }).lean(),
      FeeStructure.find({ session, term }).lean(),
      Fee.find({ session, term }).select("student amount fee_category").lean(),
      Student.find({
        $or: [
          { current_session: session },
          { "fee_enrollments.session": session }
        ]
      })
        .select(
          "full_name admission_no class class_record current_session gender status fee_enrollments createdAt"
        )
        .populate("class_record", "name session")
        .populate("fee_enrollments.class_record", "name session")
        .lean(),
      Bus.find().lean(),
      BusRoute.find().lean(),
      BusFeeStructure.find({ session, term }).lean(),
      BusEnrollment.find({ session, term, status: "active" }).lean(),
      BusPayment.find({ session, term }).select("enrollment amount").lean(),
      BoardingHouse.find().lean(),
      BoardingFeeStructure.find({ session, term }).lean(),
      BoardingEnrollment.find({ session, term, status: "active" }).lean(),
      BoardingPayment.find({ session, term }).select("enrollment amount").lean(),
      PayrollStaff.find().select("status").lean(),
      PayrollAssignment.find({ session, period: term }).lean(),
      PayrollPayment.find({ session, period: term }).select("assignment amount").lean()
    ]);

    const classesById = new Map(
      classes.map((classRecord) => [getRecordId(classRecord._id), classRecord])
    );
    const structuresByClassAndCategory = new Map(
      feeStructures.map((feeStructure) => [
        getStructureKey(
          getRecordId(feeStructure.class_record),
          feeStructure.fee_category || "returning"
        ),
        feeStructure
      ])
    );
    const feesByStudentId = fees.reduce((feeMap, fee) => {
      const studentId = getRecordId(fee.student);
      const feeCategory = fee.fee_category || "returning";
      const feeKey = `${studentId}|${feeCategory}`;

      feeMap.set(feeKey, (feeMap.get(feeKey) || 0) + Number(fee.amount || 0));

      return feeMap;
    }, new Map());

    const studentRows = buildStudentReportRows({
      students,
      classesById,
      feesByStudentId,
      structuresByClassAndCategory,
      session,
      term,
      selectedClassId
    });
    const classSummaries = buildClassSummaries({
      classes,
      studentRows,
      selectedClassId
    });
    const newlyAdmittedStudents = studentRows.filter(
      (student) => student.fee_category === "new"
    );
    const returningStudents = studentRows.filter(
      (student) => student.fee_category === "returning"
    );
    const feeCategoryCounts = studentRows.reduce((categoryCounts, student) => {
      categoryCounts[student.fee_category] =
        (categoryCounts[student.fee_category] || 0) + 1;

      return categoryCounts;
    }, {});
    const outstandingStudents = studentRows.filter(
      (student) => student.balance > 0
    ).length;
    const busSummary = buildBusSummary({
      buses,
      routes: busRoutes,
      structures: busStructures,
      enrollments: busEnrollments,
      payments: busPayments
    });
    const payrollSummary = buildPayrollSummary({
      staff: payrollStaff,
      assignments: payrollAssignments,
      payments: payrollPayments
    });
    const boardingSummary = buildBoardingSummary({
      houses: boardingHouses,
      structures: boardingStructures,
      enrollments: boardingEnrollments,
      payments: boardingPayments
    });

    res.set("Cache-Control", "no-store");
    res.json({
      selected_session: session,
      selected_term: term,
      selected_class_record: selectedClassId,
      available_sessions: availableSessions,
      available_terms: validTerms,
      class_options: classes.map((classRecord) => ({
        _id: getRecordId(classRecord._id),
        name: classRecord.name,
        session: classRecord.session
      })),
      summary: {
        total_students: studentRows.length,
        newly_admitted: newlyAdmittedStudents.length,
        returning: returningStudents.length,
        exempt: feeCategoryCounts.vip || 0,
        fee_category_counts: feeCategoryCounts,
        expected: sumRows(studentRows, "expected"),
        paid: sumRows(studentRows, "paid"),
        balance: sumRows(studentRows, "balance"),
        outstanding_students: outstandingStudents
      },
      class_summaries: classSummaries,
      newly_admitted_students: newlyAdmittedStudents,
      returning_students: returningStudents,
      bus_summary: busSummary,
      payroll_summary: req.user?.role === "chairman"
        ? {
            active_staff: 0,
            assigned_staff: 0,
            expected: 0,
            paid: 0,
            balance: 0,
            outstanding_staff: 0,
            payment_records: 0,
            category_rows: []
          }
        : payrollSummary,
      boarding_summary: boardingSummary
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getExecutiveReportOverview
};
