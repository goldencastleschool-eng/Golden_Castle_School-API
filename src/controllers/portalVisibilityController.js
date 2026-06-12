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
const { isFormTeacher } = require("../utils/teacherAssignments");

const ACCESS_KEY = "active-result-access";

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

const formatClassName = (classRecord = {}) =>
  classRecord.name ? classRecord.name.toString().toUpperCase() : "Class not set";

const formatDateTime = (dateValue) =>
  dateValue ? new Date(dateValue).toISOString() : "";

const buildMetric = (label, value) => ({
  label,
  value
});

const getStatusLabel = (status) => {
  if (status === "live") {
    return "Live";
  }

  if (status === "not_configured") {
    return "Not Configured";
  }

  return "Attention";
};

const getMissingStudentSamples = (students = []) =>
  students.slice(0, 8).map((student) => ({
    id: getRecordId(student),
    name: student.full_name || "Unnamed student",
    detail: student.admission_no || "Admission number not set"
  }));

const getTeacherSamples = (teachers = []) =>
  teachers.slice(0, 8).map((teacher) => ({
    id: getRecordId(teacher),
    name: teacher.full_name || "Unnamed teacher",
    detail: teacher.username || "Username not set"
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
    ? activeStudents.filter((student) => student.current_session === access.session)
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
    samples: [
      {
        label: "Missing student results",
        items: getMissingStudentSamples(missingStudents)
      }
    ].filter((sample) => sample.items.length > 0)
  });
};

const buildCumulativeResultsCheck = ({
  access,
  activeStudents,
  cumulativeResults,
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const configured = Boolean(access?.cumulative_session);
  const expectedStudents = configured
    ? activeStudents.filter(
        (student) => student.current_session === access.cumulative_session
      )
    : [];
  const visibleResults = configured
    ? cumulativeResults.filter(
        (result) => result.session === access.cumulative_session
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
      feature: "Student cumulative results",
      severity: "critical",
      message: "Cumulative result access is not configured.",
      action: "Open Result Upload and set the active cumulative result session."
    });
  } else if (expectedStudents.length === 0) {
    addIssue({
      issues,
      feature: "Student cumulative results",
      severity: "warning",
      message: `No active student was found for ${access.cumulative_session}.`,
      action: "Confirm the cumulative result session or student class sessions."
    });
  } else if (missingStudents.length > 0) {
    addIssue({
      issues,
      feature: "Student cumulative results",
      severity: "warning",
      message: `${missingStudents.length} cumulative result(s) are missing for ${access.cumulative_session}.`,
      action: "Upload the missing cumulative result PDFs before announcing availability.",
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

  return buildCheck({
    key: "cumulative_results",
    portal: "student",
    label: "Cumulative Results",
    description: "Session cumulative result PDFs visible from the student portal.",
    status,
    access: {
      session: access?.cumulative_session || ""
    },
    metrics: [
      buildMetric("Expected Students", expectedStudents.length),
      buildMetric("Visible Results", visibleResults.length),
      buildMetric("Missing Results", missingStudents.length)
    ],
    issues,
    samples: [
      {
        label: "Missing cumulative results",
        items: getMissingStudentSamples(missingStudents)
      }
    ].filter((sample) => sample.items.length > 0)
  });
};

const buildFeeReceiptsCheck = ({
  fees,
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

  return buildCheck({
    key: "fee_receipts",
    portal: "student",
    label: "Fee Receipts",
    description: "Recorded fee payments and printable receipts visible from the student portal.",
    status,
    access: {
      session: "All sessions",
      term: "All terms"
    },
    metrics: [
      buildMetric("Payment Records", fees.length),
      buildMetric("Visible Receipts", visibleFees.length),
      buildMetric("Students With Receipts", studentIdsWithReceipts.size),
      buildMetric("Broken Student Links", orphanedFees.length)
    ],
    issues,
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
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const classStudentRows = classes
    .map((classRecord) => {
      const students = activeStudents.filter((student) =>
        studentBelongsToClassRecord(student, classRecord)
      );

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
    activeFormTeachers
      .map((teacher) => getRecordId(teacher.assigned_class_record))
      .filter(Boolean)
  );
  const teachersWithoutClass = activeFormTeachers.filter(
    (teacher) => !getRecordId(teacher.assigned_class_record)
  );
  const classesWithoutTeacher = classStudentRows.filter(
    (row) => !formTeacherClassIds.has(getRecordId(row.classRecord))
  );
  const teachersWithEmptyClass = activeFormTeachers.filter((teacher) => {
    const classRecordId = getRecordId(teacher.assigned_class_record);

    return classRecordId && !classIdsWithStudents.has(classRecordId);
  });
  const visibleClassLists = activeFormTeachers.filter((teacher) => {
    const classRecordId = getRecordId(teacher.assigned_class_record);

    return classRecordId && classIdsWithStudents.has(classRecordId);
  });

  if (activeFormTeachers.length === 0) {
    addIssue({
      issues,
      feature: "Teacher class list",
      severity: "critical",
      message: "No active form teacher is available for class-list access.",
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

  return buildCheck({
    key: "teacher_class_list",
    portal: "teacher",
    label: "Class Lists",
    description: "Student class lists visible to active form teachers.",
    status,
    access: {
      session: "Active assignments"
    },
    metrics: [
      buildMetric("Visible Class Lists", visibleClassLists.length),
      buildMetric("Classes With Students", classStudentRows.length),
      buildMetric("Classes Without Form Teacher", classesWithoutTeacher.length),
      buildMetric("Teachers Without Class", teachersWithoutClass.length)
    ],
    issues,
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
  activeFormTeachers,
  records,
  addIssue,
  buildCheck
}) => {
  const issues = [];
  const configured = Boolean(accessSession && accessTerm);
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
          record.term === accessTerm
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

  if (!configured) {
    addIssue({
      issues,
      feature,
      severity: "critical",
      message: `${label} access is not configured.`,
      action: "Open Result Upload and set the active teacher access session and term."
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
    addIssue({
      issues,
      feature,
      severity: "warning",
      message: `${missingTeachers.length} active form teacher(s) are missing ${label.toLowerCase()} uploads for ${accessSession} ${accessTerm}.`,
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
      term: accessTerm || ""
    },
    metrics: [
      buildMetric("Expected Teachers", expectedTeachers.length),
      buildMetric("Visible Uploads", visibleRecordKeys.size),
      buildMetric("Missing Uploads", missingTeachers.length),
      buildMetric("Blocked Uploads", blockedRecords.length)
    ],
    issues,
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
      cumulativeResults,
      fees,
      broadsheets,
      classResults
    ] = await Promise.all([
      ResultAccess.findOne({ key: ACCESS_KEY }).lean(),
      Student.find(activeStudentStatusQuery)
        .select("full_name admission_no class class_record current_session status")
        .lean(),
      Teacher.find()
        .select("-password -initial_password")
        .populate("assigned_class_record")
        .lean(),
      Class.find().lean(),
      Result.find(pdfRecordQuery).select("-pdf_data").lean(),
      CumulativeResult.find(pdfRecordQuery).select("-pdf_data").lean(),
      Fee.find()
        .select("-expected_items_at_payment")
        .populate("student", "full_name admission_no class current_session status")
        .lean(),
      ClassBroadsheet.find(pdfRecordQuery).select("-pdf_data").lean(),
      ClassResult.find(pdfRecordQuery).select("-pdf_data").lean()
    ]);

    const activeFormTeachers = teachers.filter(
      (teacher) => isActiveTeacher(teacher) && isFormTeacher(teacher)
    );
    const accessRecord = access || {};
    const checks = [
      buildStudentResultsCheck({
        access: accessRecord,
        activeStudents: students,
        results,
        addIssue,
        buildCheck
      }),
      buildCumulativeResultsCheck({
        access: accessRecord,
        activeStudents: students,
        cumulativeResults,
        addIssue,
        buildCheck
      }),
      buildFeeReceiptsCheck({
        fees,
        addIssue,
        buildCheck
      }),
      buildTeacherClassListCheck({
        activeStudents: students,
        classes,
        activeFormTeachers,
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
      access: {
        student_results: {
          session: accessRecord.session || "",
          term: accessRecord.term || ""
        },
        cumulative_results: {
          session: accessRecord.cumulative_session || ""
        },
        teacher_broadsheets: {
          session: accessRecord.broadsheet_session || "",
          term: accessRecord.broadsheet_term || ""
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
