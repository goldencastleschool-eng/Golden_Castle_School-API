const Class = require("../models/classModel");
const ClassBroadsheet = require("../models/classBroadsheetModel");
const ClassResult = require("../models/classResultModel");
const CumulativeResult = require("../models/cumulativeResultModel");
const Fee = require("../models/feeModel");
const Result = require("../models/resultModel");
const ResultAccess = require("../models/resultAccessModel");
const Student = require("../models/studentModel");
const Teacher = require("../models/teacherModel");
const { normalizeClassName } = require("../utils/classRecords");
const {
  getStudentEffectiveTermEnrollment
} = require("../utils/studentTermEnrollment");
const { isFormTeacher } = require("../utils/teacherAssignments");

const ACCESS_KEY = "active-result-access";
const CUMULATIVE_TERM_LABEL = "Third Term";

const pdfRecordQuery = {
  $or: [
    { pdf_file_id: { $exists: true, $ne: null } },
    { pdf_data: { $exists: true, $ne: null } }
  ]
};

const activeStudentStatusQuery = {
  $or: [
    { status: "active" },
    { status: { $exists: false } },
    { status: null },
    { status: "" }
  ]
};

const getRecordId = (record) => {
  if (!record) {
    return "";
  }

  if (record._id) {
    return record._id.toString();
  }

  return record.toString();
};

const isActiveTeacher = (teacher = {}) =>
  !teacher.status || teacher.status !== "inactive";

const studentBelongsToClassRecord = (student = {}, classRecord = {}) => {
  if (!student || !classRecord) {
    return false;
  }

  const studentClassRecordId = getRecordId(student.class_record);
  const classRecordId = getRecordId(classRecord);
  const sameClassRecord =
    studentClassRecordId && classRecordId && studentClassRecordId === classRecordId;
  const sameLegacyClass =
    normalizeClassName(student.class) === normalizeClassName(classRecord.name);

  return student.current_session === classRecord.session && (sameClassRecord || sameLegacyClass);
};

const studentBelongsToEffectiveTermClassRecord = (
  student = {},
  classRecord = {},
  session = "",
  term = ""
) => {
  const enrollment = getStudentEffectiveTermEnrollment(student, session, term);

  if (!enrollment || !classRecord) {
    return false;
  }

  const enrollmentClassRecordId = getRecordId(enrollment.class_record);
  const classRecordId = getRecordId(classRecord);
  const sameClassRecord =
    enrollmentClassRecordId &&
    classRecordId &&
    enrollmentClassRecordId === classRecordId;
  const sameLegacyClass =
    normalizeClassName(enrollment.class) === normalizeClassName(classRecord.name);

  return sameClassRecord || sameLegacyClass;
};

const formatClassName = (classRecord = {}) =>
  classRecord.name ? classRecord.name.toString().toUpperCase() : "Class not set";

const formatStudentClassName = (student = {}, enrollment = null) => {
  const className =
    enrollment?.class ||
    enrollment?.class_record?.name ||
    student.class;

  return className ? className.toString().toUpperCase() : "Class not set";
};

const getStudentClassKey = (student = {}, enrollment = null) => {
  const classRecordId = getRecordId(enrollment?.class_record || student.class_record);

  if (classRecordId) {
    return classRecordId;
  }

  return `${normalizeClassName(enrollment?.class || student.class)}:${enrollment?.session || student.current_session || ""}`;
};

const getStatusLabel = (status) => {
  if (status === "live") {
    return "Live";
  }

  if (status === "not_configured") {
    return "Not Configured";
  }

  return "Attention";
};

const formatDateTime = (dateValue) =>
  dateValue ? new Date(dateValue).toISOString() : "";

const buildMetric = (label, value) => ({
  label,
  value
});

const buildClassSummaryRow = ({
  id,
  className,
  session = "",
  term = "",
  status,
  expectedLabel,
  expectedCount = 0,
  visibleLabel,
  visibleCount = 0,
  missingLabel,
  missingCount = 0,
  detail = ""
}) => ({
  id,
  class_name: className || "Class not set",
  session,
  term,
  status,
  status_label: getStatusLabel(status),
  expected_label: expectedLabel,
  expected_count: expectedCount,
  visible_label: visibleLabel,
  visible_count: visibleCount,
  missing_label: missingLabel,
  missing_count: missingCount,
  detail
});

const buildStudentClassSummary = ({
  students = [],
  visibleStudentIds = new Set(),
  statusForAll = "",
  expectedLabel = "Students",
  visibleLabel = "Visible",
  missingLabel = "Missing",
  session = "",
  term = "",
  detail = ""
}) => {
  const classMap = new Map();

  students.forEach((student) => {
    const enrollment =
      session && term
        ? getStudentEffectiveTermEnrollment(student, session, term)
        : null;
    const classKey = getStudentClassKey(student, enrollment);

    if (!classMap.has(classKey)) {
      classMap.set(classKey, {
        id: classKey,
        className: formatStudentClassName(student, enrollment),
        session: enrollment?.session || student.current_session || "",
        expectedCount: 0,
        visibleCount: 0
      });
    }

    const classRow = classMap.get(classKey);
    classRow.expectedCount += 1;

    if (visibleStudentIds.has(getRecordId(student))) {
      classRow.visibleCount += 1;
    }
  });

  return Array.from(classMap.values())
    .sort(
      (firstRow, secondRow) =>
        firstRow.session.localeCompare(secondRow.session) ||
        firstRow.className.localeCompare(secondRow.className)
    )
    .map((classRow) => {
      const missingCount = Math.max(
        classRow.expectedCount - classRow.visibleCount,
        0
      );
      const status =
        statusForAll || (missingCount === 0 ? "live" : "attention");

      return buildClassSummaryRow({
        id: classRow.id,
        className: classRow.className,
        session: classRow.session,
        term,
        status,
        expectedLabel,
        expectedCount: classRow.expectedCount,
        visibleLabel,
        visibleCount: classRow.visibleCount,
        missingLabel,
        missingCount: status === "not_configured" ? 0 : missingCount,
        detail
      });
    });
};

const buildFeeReceiptClassSummary = (fees = []) => {
  const classMap = new Map();

  fees.forEach((fee) => {
    const student = fee.student || {};
    const hasStudent = Boolean(fee.student);
    const classKey = hasStudent
      ? getStudentClassKey(student)
      : `orphaned:${normalizeClassName(fee.class)}:${fee.session || ""}`;

    if (!classMap.has(classKey)) {
      classMap.set(classKey, {
        id: classKey,
        className: hasStudent
          ? formatStudentClassName(student)
          : fee.class
            ? fee.class.toString().toUpperCase()
            : "Missing student link",
        session: hasStudent ? student.current_session || "" : fee.session || "",
        paymentCount: 0,
        studentIds: new Set(),
        brokenCount: 0
      });
    }

    const classRow = classMap.get(classKey);
    classRow.paymentCount += 1;

    if (hasStudent) {
      classRow.studentIds.add(getRecordId(student));
    } else {
      classRow.brokenCount += 1;
    }
  });

  return Array.from(classMap.values())
    .sort(
      (firstRow, secondRow) =>
        firstRow.session.localeCompare(secondRow.session) ||
        firstRow.className.localeCompare(secondRow.className)
    )
    .map((classRow) =>
      buildClassSummaryRow({
        id: classRow.id,
        className: classRow.className,
        session: classRow.session,
        status: classRow.brokenCount > 0 ? "attention" : "live",
        expectedLabel: "Payments",
        expectedCount: classRow.paymentCount,
        visibleLabel: "Students",
        visibleCount: classRow.studentIds.size,
        missingLabel: "Broken",
        missingCount: classRow.brokenCount
      })
    );
};

const getMissingStudentSamples = (students = []) =>
  students.slice(0, 8).map((student) => ({
    id: getRecordId(student),
    name: student.full_name || "Unnamed student",
    detail: `${student.admission_no || "Admission number not set"} | ${formatStudentClassName(student)}`
  }));

const getTeacherSamples = (teachers = []) =>
  teachers.slice(0, 8).map((teacher) => ({
    id: getRecordId(teacher),
    name: teacher.full_name || "Unnamed teacher",
    detail: `${teacher.username || "Username not set"} | ${
      formatClassName(teacher.assigned_class_record) ||
      teacher.assigned_class ||
      "Class not set"
    }`
  }));

const createPortalVisibilityController = () => {
  let issueCounter = 0;
  const allIssues = [];

  const addIssue = ({
    issues,
    feature,
    severity = "warning",
    message,
    action = "",
    meta = {}
  }) => {
    issueCounter += 1;

    const issue = {
      id: `portal-visibility-${issueCounter}`,
      feature,
      severity,
      message,
      action,
      meta
    };

    issues.push(issue);
    allIssues.push(issue);

    return issue;
  };

  const buildCheck = ({
    key,
    portal,
    label,
    description,
    status,
    access = {},
    metrics = [],
    issues = [],
    classSummary = [],
    samples = []
  }) => ({
    key,
    portal,
    label,
    description,
    status,
    status_label: getStatusLabel(status),
    access,
    metrics,
    issues,
    class_summary: classSummary,
    samples
  });

  return {
    addIssue,
    buildCheck,
    allIssues
  };
};

const buildStudentResultsCheck = ({
  access,
  activeStudents,
  results,
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const configured = Boolean(access?.session && access?.term);
  const expectedStudents = configured
    ? activeStudents.filter((student) =>
        Boolean(
          getStudentEffectiveTermEnrollment(student, access.session, access.term)
        )
      )
    : [];
  const visibleResults = configured
    ? results.filter(
        (result) =>
          result.session === access.session &&
          result.term === access.term
      )
    : [];
  const visibleStudentIds = new Set(
    visibleResults.map((result) => getRecordId(result.student))
  );
  const missingStudents = expectedStudents.filter(
    (student) => !visibleStudentIds.has(getRecordId(student))
  );

  if (!configured) {
    addIssue({
      issues,
      feature: "Student term results",
      severity: "critical",
      message: "Student term result access is not configured.",
      action: "Open Result Upload and set the active student result session and term."
    });
  } else if (expectedStudents.length === 0) {
    addIssue({
      issues,
      feature: "Student term results",
      severity: "warning",
      message: `No active student was found for ${access.session}.`,
      action: "Confirm the active result session or student class sessions."
    });
  } else if (missingStudents.length > 0) {
    addIssue({
      issues,
      feature: "Student term results",
      severity: "warning",
      message: `${missingStudents.length} active student result(s) are missing for ${access.session} ${access.term}.`,
      action: "Upload the missing student result PDFs before announcing result availability.",
      meta: {
        missing_count: missingStudents.length
      }
    });
  }

  const status = !configured
    ? "not_configured"
    : issues.length > 0
      ? "attention"
      : "live";
  const classSummary = configured
    ? buildStudentClassSummary({
        students: expectedStudents,
        visibleStudentIds,
        expectedLabel: "Students",
        visibleLabel: "Results",
        missingLabel: "Missing",
        session: access?.session || "",
        term: access?.term || ""
      })
    : buildStudentClassSummary({
        students: activeStudents,
        visibleStudentIds: new Set(),
        statusForAll: "not_configured",
        expectedLabel: "Students",
        visibleLabel: "Results",
        missingLabel: "Missing",
        detail: "Set active result session and term"
      });

  return buildCheck({
    key: "student_results",
    portal: "student",
    label: "Student Results",
    description: "Termly result PDFs visible from the student portal.",
    status,
    access: {
      session: access?.session || "",
      term: access?.term || ""
    },
    metrics: [
      buildMetric("Expected Students", expectedStudents.length),
      buildMetric("Visible Results", visibleResults.length),
      buildMetric("Missing Results", missingStudents.length)
    ],
    issues,
    classSummary,
    samples: [
      {
        label: "Missing student results",
        items: getMissingStudentSamples(missingStudents)
      }
    ].filter((sample) => sample.items.length > 0)
  });
};

const buildFeeReceiptsCheck = ({
  fees,
  accessSession = "",
  accessTerm = "",
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const visibleFees = fees.filter((fee) => Boolean(fee.student));
  const orphanedFees = fees.filter((fee) => !fee.student);
  const studentIdsWithReceipts = new Set(
    visibleFees.map((fee) => getRecordId(fee.student))
  );
  const latestPayment = visibleFees
    .map((fee) => fee.payment_date)
    .filter(Boolean)
    .sort((firstDate, secondDate) => new Date(secondDate) - new Date(firstDate))[0];

  if (fees.length === 0) {
    addIssue({
      issues,
      feature: "Fee receipts",
      severity: "warning",
      message: "No fee payment receipt is currently available in the student portal.",
      action: "Record fee payments once students start paying."
    });
  }

  if (orphanedFees.length > 0) {
    addIssue({
      issues,
      feature: "Fee receipts",
      severity: "critical",
      message: `${orphanedFees.length} fee payment record(s) are linked to missing student accounts.`,
      action: "Review deleted/missing student records or correct the affected fee payments.",
      meta: {
        orphaned_count: orphanedFees.length
      }
    });
  }

  const status =
    fees.length > 0 && orphanedFees.length === 0 ? "live" : "attention";
  const classSummary = buildFeeReceiptClassSummary(fees);

  return buildCheck({
    key: "fee_receipts",
    portal: "student",
    label: "Fee Receipts",
    description: "Recorded fee payments and printable receipts visible from the student portal.",
    status,
    access: {
      session: accessSession || "All sessions",
      term: accessTerm || "All terms"
    },
    metrics: [
      buildMetric("Payment Records", fees.length),
      buildMetric("Visible Receipts", visibleFees.length),
      buildMetric("Students With Receipts", studentIdsWithReceipts.size),
      buildMetric("Broken Student Links", orphanedFees.length)
    ],
    issues,
    classSummary,
    samples: [
      {
        label: "Latest visible payment",
        items: latestPayment
          ? [
              {
                id: "latest-payment",
                name: "Latest payment date",
                detail: formatDateTime(latestPayment)
              }
            ]
          : []
      }
    ].filter((sample) => sample.items.length > 0)
  });
};

const buildTeacherClassListCheck = ({
  activeStudents,
  classes,
  activeFormTeachers,
  accessSession,
  accessTerm,
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const configured = Boolean(accessSession && accessTerm);
  const filteredClasses = accessSession
    ? classes.filter((classRecord) => classRecord.session === accessSession)
    : classes;
  const filteredFormTeachers = accessSession
    ? activeFormTeachers.filter((teacher) => teacher.session === accessSession)
    : activeFormTeachers;
  const classStudentRows = filteredClasses
    .map((classRecord) => {
      const students = activeStudents.filter((student) => {
        if (configured) {
          return studentBelongsToEffectiveTermClassRecord(
            student,
            classRecord,
            accessSession,
            accessTerm
          );
        }

        return studentBelongsToClassRecord(student, classRecord);
      });

      return {
        classRecord,
        students
      };
    })
    .filter((row) => row.students.length > 0);
  const classIdsWithStudents = new Set(
    classStudentRows.map((row) => getRecordId(row.classRecord))
  );
  const formTeacherClassIds = new Set(
    filteredFormTeachers
      .map((teacher) => getRecordId(teacher.assigned_class_record))
      .filter(Boolean)
  );
  const teachersWithoutClass = filteredFormTeachers.filter(
    (teacher) => !getRecordId(teacher.assigned_class_record)
  );
  const classesWithoutTeacher = classStudentRows.filter(
    (row) => !formTeacherClassIds.has(getRecordId(row.classRecord))
  );
  const teachersWithEmptyClass = filteredFormTeachers.filter((teacher) => {
    const classRecordId = getRecordId(teacher.assigned_class_record);

    return classRecordId && !classIdsWithStudents.has(classRecordId);
  });
  const visibleClassLists = filteredFormTeachers.filter((teacher) => {
    const classRecordId = getRecordId(teacher.assigned_class_record);

    return classRecordId && classIdsWithStudents.has(classRecordId);
  });
  const teacherCountByClassId = new Map();

  filteredFormTeachers.forEach((teacher) => {
    const classRecordId = getRecordId(teacher.assigned_class_record);

    if (!classRecordId) {
      return;
    }

    teacherCountByClassId.set(
      classRecordId,
      (teacherCountByClassId.get(classRecordId) || 0) + 1
    );
  });

  if (filteredFormTeachers.length === 0) {
    addIssue({
      issues,
      feature: "Teacher class list",
      severity: "critical",
      message: accessSession
        ? `No active form teacher is available for ${accessSession} class-list access.`
        : "No active form teacher is available for class-list access.",
      action: "Register or reactivate form teachers and assign them to classes."
    });
  }

  if (teachersWithoutClass.length > 0) {
    addIssue({
      issues,
      feature: "Teacher class list",
      severity: "warning",
      message: `${teachersWithoutClass.length} active form teacher(s) do not have an assigned class.`,
      action: "Edit the form teacher record and assign the correct class.",
      meta: {
        teacher_count: teachersWithoutClass.length
      }
    });
  }

  if (classesWithoutTeacher.length > 0) {
    addIssue({
      issues,
      feature: "Teacher class list",
      severity: "warning",
      message: `${classesWithoutTeacher.length} class(es) with active students have no active form teacher.`,
      action: "Assign a form teacher to each class with active students.",
      meta: {
        class_count: classesWithoutTeacher.length
      }
    });
  }

  if (teachersWithEmptyClass.length > 0) {
    addIssue({
      issues,
      feature: "Teacher class list",
      severity: "warning",
      message: `${teachersWithEmptyClass.length} form teacher class assignment(s) have no active students.`,
      action: "Confirm the teacher assignment or student class/session records.",
      meta: {
        teacher_count: teachersWithEmptyClass.length
      }
    });
  }

  const status =
    visibleClassLists.length > 0 && issues.length === 0 ? "live" : "attention";
  const classSummary = [
    ...classStudentRows.map((row) => {
      const classRecordId = getRecordId(row.classRecord);
      const formTeacherCount = teacherCountByClassId.get(classRecordId) || 0;

      return buildClassSummaryRow({
        id: classRecordId,
        className: formatClassName(row.classRecord),
        session: row.classRecord.session || "",
        status: formTeacherCount > 0 ? "live" : "attention",
        expectedLabel: "Students",
        expectedCount: row.students.length,
        visibleLabel: "Form Teachers",
        visibleCount: formTeacherCount,
        missingLabel: "Missing Teacher",
        missingCount: formTeacherCount > 0 ? 0 : 1
      });
    }),
    ...teachersWithEmptyClass.map((teacher) => {
      const classRecord = teacher.assigned_class_record || {};
      const classRecordId = getRecordId(classRecord);

      return buildClassSummaryRow({
        id: `empty-${getRecordId(teacher)}-${classRecordId}`,
        className: formatClassName(classRecord),
        session: classRecord.session || teacher.session || "",
        status: "attention",
        expectedLabel: "Students",
        expectedCount: 0,
        visibleLabel: "Form Teachers",
        visibleCount: 1,
        missingLabel: "Missing",
        missingCount: 0,
        detail: "Assigned class has no active students"
      });
    })
  ];

  return buildCheck({
    key: "teacher_class_list",
    portal: "teacher",
    label: "Class Lists",
    description: "Student class lists visible to active form teachers.",
    status,
    access: {
      session: accessSession || "Active assignments",
      term: accessTerm || ""
    },
    metrics: [
      buildMetric("Visible Class Lists", visibleClassLists.length),
      buildMetric("Classes With Students", classStudentRows.length),
      buildMetric("Classes Without Form Teacher", classesWithoutTeacher.length),
      buildMetric("Teachers Without Class", teachersWithoutClass.length)
    ],
    issues,
    classSummary,
    samples: [
      {
        label: "Teachers without class",
        items: getTeacherSamples(teachersWithoutClass)
      },
      {
        label: "Classes without form teacher",
        items: classesWithoutTeacher.slice(0, 8).map((row) => ({
          id: getRecordId(row.classRecord),
          name: formatClassName(row.classRecord),
          detail: `${row.classRecord.session} - ${row.students.length} active student(s)`
        }))
      }
    ].filter((sample) => sample.items.length > 0)
  });
};

const buildTeacherPdfCheck = ({
  key,
  label,
  description,
  feature,
  accessSession,
  accessTerm,
  termRequired = true,
  displayTerm = accessTerm,
  activeFormTeachers,
  records,
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const configured = Boolean(accessSession && (!termRequired || accessTerm));
  const expectedTeachers = configured
    ? activeFormTeachers.filter(
        (teacher) =>
          teacher.session === accessSession &&
          Boolean(getRecordId(teacher.assigned_class_record))
      )
    : [];
  const activeWindowRecords = configured
    ? records.filter(
        (record) =>
          record.session === accessSession &&
          (!termRequired || record.term === accessTerm)
      )
    : [];
  const visibleRecordKeys = new Set();
  const blockedRecords = [];

  activeWindowRecords.forEach((record) => {
    const teacherId = getRecordId(record.assigned_teacher);
    const classRecordId = getRecordId(record.class_record);
    const teacher = activeFormTeachers.find(
      (activeTeacher) => getRecordId(activeTeacher) === teacherId
    );
    const teacherClassId = getRecordId(teacher?.assigned_class_record);

    if (teacher && teacherClassId && teacherClassId === classRecordId) {
      visibleRecordKeys.add(`${teacherId}:${classRecordId}`);
      return;
    }

    blockedRecords.push(record);
  });

  const missingTeachers = expectedTeachers.filter((teacher) => {
    const teacherId = getRecordId(teacher);
    const classRecordId = getRecordId(teacher.assigned_class_record);

    return !visibleRecordKeys.has(`${teacherId}:${classRecordId}`);
  });
  const classSummaryTeachers = configured
    ? expectedTeachers
    : activeFormTeachers.filter((teacher) =>
        Boolean(getRecordId(teacher.assigned_class_record))
      );
  const expectedPairKeys = new Set(
    expectedTeachers.map(
      (teacher) =>
        `${getRecordId(teacher)}:${getRecordId(teacher.assigned_class_record)}`
    )
  );
  const classSummary = [
    ...classSummaryTeachers.map((teacher) => {
      const teacherId = getRecordId(teacher);
      const classRecord = teacher.assigned_class_record || {};
      const classRecordId = getRecordId(classRecord);
      const visible = visibleRecordKeys.has(`${teacherId}:${classRecordId}`);
      const rowStatus = !configured
        ? "not_configured"
        : visible
          ? "live"
          : "attention";

      return buildClassSummaryRow({
        id: `${key}-${teacherId}-${classRecordId}`,
        className: formatClassName(classRecord),
        session: configured ? accessSession : teacher.session || "",
        term: configured ? displayTerm || "" : "",
        status: rowStatus,
        expectedLabel: "Teachers",
        expectedCount: 1,
        visibleLabel: "Uploads",
        visibleCount: visible ? 1 : 0,
        missingLabel: "Missing",
        missingCount: configured && !visible ? 1 : 0,
        detail: teacher.username || teacher.full_name || ""
      });
    }),
    ...blockedRecords
      .filter((record) => {
        const pairKey = `${getRecordId(record.assigned_teacher)}:${getRecordId(
          record.class_record
        )}`;

        return !expectedPairKeys.has(pairKey);
      })
      .map((record) =>
        buildClassSummaryRow({
          id: `${key}-blocked-${getRecordId(record)}`,
          className: record.class
            ? record.class.toString().toUpperCase()
            : "Class not set",
          session: record.session || accessSession || "",
          term: record.term || displayTerm || accessTerm || "",
          status: "attention",
          expectedLabel: "Teachers",
          expectedCount: 0,
          visibleLabel: "Uploads",
          visibleCount: 0,
          missingLabel: "Blocked",
          missingCount: 1,
          detail: "Upload exists but is not reachable by the assigned teacher"
        })
      )
  ];

  if (!configured) {
    addIssue({
      issues,
      feature,
      severity: "critical",
      message: `${label} access is not configured.`,
      action: termRequired
        ? "Open Result Upload and set the active teacher access session and term."
        : "Open Result Upload and set the active teacher access session."
    });
  } else if (expectedTeachers.length === 0) {
    addIssue({
      issues,
      feature,
      severity: "warning",
      message: `No active form teacher assignment was found for ${accessSession}.`,
      action: "Confirm form teacher assignments for the active session."
    });
  } else if (missingTeachers.length > 0) {
    const windowLabel = [accessSession, displayTerm || accessTerm]
      .filter(Boolean)
      .join(" ");

    addIssue({
      issues,
      feature,
      severity: "warning",
      message: `${missingTeachers.length} active form teacher(s) are missing ${label.toLowerCase()} uploads for ${windowLabel}.`,
      action: `Upload the missing ${label.toLowerCase()} PDFs for the active teacher access window.`,
      meta: {
        missing_count: missingTeachers.length
      }
    });
  }

  if (blockedRecords.length > 0) {
    addIssue({
      issues,
      feature,
      severity: "critical",
      message: `${blockedRecords.length} ${label.toLowerCase()} upload(s) are not reachable by their assigned teacher.`,
      action: "Check inactive teachers, wrong teacher assignments, or class mismatches.",
      meta: {
        blocked_count: blockedRecords.length
      }
    });
  }

  const status = !configured
    ? "not_configured"
    : issues.length > 0
      ? "attention"
      : "live";

  return buildCheck({
    key,
    portal: "teacher",
    label,
    description,
    status,
    access: {
      session: accessSession || "",
      term: displayTerm || accessTerm || ""
    },
    metrics: [
      buildMetric("Expected Teachers", expectedTeachers.length),
      buildMetric("Visible Uploads", visibleRecordKeys.size),
      buildMetric("Missing Uploads", missingTeachers.length),
      buildMetric("Blocked Uploads", blockedRecords.length)
    ],
    issues,
    classSummary,
    samples: [
      {
        label: `Missing ${label.toLowerCase()} uploads`,
        items: getTeacherSamples(missingTeachers)
      }
    ].filter((sample) => sample.items.length > 0)
  });
};

const getAdminPortalVisibility = async (req, res) => {
  try {
    const {
      addIssue,
      buildCheck,
      allIssues
    } = createPortalVisibilityController();

    const [
      access,
      students,
      teachers,
      classes,
      results,
      fees,
      cumulativeResults,
      broadsheets,
      classResults
    ] = await Promise.all([
      ResultAccess.findOne({ key: ACCESS_KEY }).lean(),
      Student.find(activeStudentStatusQuery)
        .select("full_name admission_no class class_record current_session status fee_enrollments")
        .populate("fee_enrollments.class_record")
        .lean(),
      Teacher.find()
        .select("-password -initial_password")
        .populate("assigned_class_record")
        .lean(),
      Class.find().lean(),
      Result.find(pdfRecordQuery).select("-pdf_data").lean(),
      Fee.find()
        .select("-expected_items_at_payment")
        .populate("student", "full_name admission_no class current_session status")
        .lean(),
      CumulativeResult.find(pdfRecordQuery).select("-pdf_data").lean(),
      ClassBroadsheet.find(pdfRecordQuery).select("-pdf_data").lean(),
      ClassResult.find(pdfRecordQuery).select("-pdf_data").lean()
    ]);

    const activeFormTeachers = teachers.filter(
      (teacher) => isActiveTeacher(teacher) && isFormTeacher(teacher)
    );
    const auditSession = req.query.session?.toString().trim();
    const auditTerm = req.query.term?.toString().trim();
    const sourceAccessRecord = access || {};
    const accessRecord = {
      ...sourceAccessRecord,
      session: auditSession || sourceAccessRecord.session,
      term: auditTerm || sourceAccessRecord.term,
      broadsheet_session:
        auditSession || sourceAccessRecord.broadsheet_session,
      broadsheet_term:
        auditTerm || sourceAccessRecord.broadsheet_term,
      cumulative_session:
        auditSession || sourceAccessRecord.cumulative_session,
      class_result_session:
        auditSession || sourceAccessRecord.class_result_session,
      class_result_term:
        auditTerm || sourceAccessRecord.class_result_term
    };
    const filteredFees = fees.filter((fee) => {
      const matchesSession = !auditSession || fee.session === auditSession;
      const matchesTerm = !auditTerm || fee.term === auditTerm;

      return matchesSession && matchesTerm;
    });
    const checks = [
      buildStudentResultsCheck({
        access: accessRecord,
        activeStudents: students,
        results,
        addIssue,
        buildCheck
      }),
      buildFeeReceiptsCheck({
        fees: auditSession || auditTerm ? filteredFees : fees,
        accessSession: auditSession,
        accessTerm: auditTerm,
        addIssue,
        buildCheck
      }),
      buildTeacherClassListCheck({
        activeStudents: students,
        classes,
        activeFormTeachers,
        accessSession: accessRecord.session,
        accessTerm: accessRecord.term,
        addIssue,
        buildCheck
      }),
      buildTeacherPdfCheck({
        key: "teacher_broadsheets",
        label: "Broadsheets",
        description: "Class broadsheet PDFs visible to assigned form teachers.",
        feature: "Teacher broadsheets",
        accessSession: accessRecord.broadsheet_session,
        accessTerm: accessRecord.broadsheet_term,
        activeFormTeachers,
        records: broadsheets,
        addIssue,
        buildCheck
      }),
      buildTeacherPdfCheck({
        key: "teacher_cumulative_results",
        label: "Cumulative Results",
        description: "Third Term cumulative result PDFs visible to assigned form teachers.",
        feature: "Teacher cumulative results",
        accessSession: accessRecord.cumulative_session,
        accessTerm: "",
        termRequired: false,
        displayTerm: CUMULATIVE_TERM_LABEL,
        activeFormTeachers,
        records: cumulativeResults,
        addIssue,
        buildCheck
      }),
      buildTeacherPdfCheck({
        key: "teacher_class_results",
        label: "Class Results",
        description: "Class result PDFs visible to assigned form teachers.",
        feature: "Teacher class results",
        accessSession: accessRecord.class_result_session,
        accessTerm: accessRecord.class_result_term,
        activeFormTeachers,
        records: classResults,
        addIssue,
        buildCheck
      })
    ];

    const statusCounts = checks.reduce(
      (summary, check) => ({
        ...summary,
        [check.status]: (summary[check.status] || 0) + 1
      }),
      {
        live: 0,
        attention: 0,
        not_configured: 0
      }
    );

    res.json({
      checked_at: new Date().toISOString(),
      audit_filter: {
        session: auditSession || "",
        term: auditTerm || "",
        using_live_access: !auditSession && !auditTerm
      },
      access: {
        student_results: {
          session: accessRecord.session || "",
          term: accessRecord.term || ""
        },
        teacher_broadsheets: {
          session: accessRecord.broadsheet_session || "",
          term: accessRecord.broadsheet_term || ""
        },
        teacher_cumulative_results: {
          session: accessRecord.cumulative_session || "",
          term: CUMULATIVE_TERM_LABEL
        },
        teacher_class_results: {
          session: accessRecord.class_result_session || "",
          term: accessRecord.class_result_term || ""
        }
      },
      summary: {
        total_checks: checks.length,
        issue_count: allIssues.length,
        live_checks: statusCounts.live,
        attention_checks: statusCounts.attention,
        not_configured_checks: statusCounts.not_configured
      },
      checks,
      issues: allIssues
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getAdminPortalVisibility
};
