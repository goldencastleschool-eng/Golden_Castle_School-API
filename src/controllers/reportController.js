const Class = require("../models/classModel");
const Fee = require("../models/feeModel");
const FeeStructure = require("../models/feeStructureModel");
const Student = require("../models/studentModel");

const validTerms = ["First Term", "Second Term", "Third Term"];

const normalizeValue = (value = "") => value.toString().trim();

const normalizeClassName = (className = "") =>
  normalizeValue(className).toLowerCase().replace(/\s+/g, "");

const getRecordId = (record) => record?._id?.toString?.() || record?.toString?.() || "";

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

      const paid = feesByStudentId.get(getRecordId(student._id)) || 0;
      const structure = structuresByClassAndCategory.get(
        getStructureKey(classRecordId, feeCategory)
      );
      const expected = Number(structure?.amount || 0);
      const balance = Math.max(expected - paid, 0);
      const paymentStatus =
        expected <= 0 && paid <= 0
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
    summary.expected += student.expected;
    summary.paid += student.paid;
    summary.balance += student.balance;

    if (student.fee_category === "new") {
      summary.newly_admitted += 1;
    } else {
      summary.returning += 1;
    }

    if (student.payment_status === "Fully Paid") {
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
          expected: 0,
          paid: 0,
          balance: 0,
          outstanding_students: 0
        },
        class_summaries: [],
        newly_admitted_students: [],
        returning_students: []
      });
    }

    const [classes, feeStructures, fees, students] = await Promise.all([
      Class.find({ session }).sort({ name: 1 }).lean(),
      FeeStructure.find({ session, term }).lean(),
      Fee.find({ session, term }).select("student amount").lean(),
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
        .lean()
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
      feeMap.set(studentId, (feeMap.get(studentId) || 0) + Number(fee.amount || 0));

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
      (student) => student.fee_category !== "new"
    );
    const outstandingStudents = studentRows.filter(
      (student) => student.balance > 0
    ).length;

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
        expected: sumRows(studentRows, "expected"),
        paid: sumRows(studentRows, "paid"),
        balance: sumRows(studentRows, "balance"),
        outstanding_students: outstandingStudents
      },
      class_summaries: classSummaries,
      newly_admitted_students: newlyAdmittedStudents,
      returning_students: returningStudents
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
