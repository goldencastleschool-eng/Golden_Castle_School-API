const { isSecondaryClass } = require("./classSections");

const TEACHER_ASSIGNMENT_TYPES = {
  FORM: "form_teacher",
  CLASS: "class_teacher"
};

const TEACHER_ASSIGNMENT_LABELS = {
  [TEACHER_ASSIGNMENT_TYPES.FORM]: "Form Teacher",
  [TEACHER_ASSIGNMENT_TYPES.CLASS]: "Class Teacher"
};

const VALID_TEACHER_ASSIGNMENT_TYPES = Object.values(
  TEACHER_ASSIGNMENT_TYPES
);

const compactValue = (value = "") =>
  value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizeTeacherAssignmentType = (assignmentType = "") => {
  const compactType = compactValue(assignmentType);

  if (!compactType) {
    return "";
  }

  if (compactType === "form" || compactType === "formteacher") {
    return TEACHER_ASSIGNMENT_TYPES.FORM;
  }

  if (compactType === "class" || compactType === "classteacher") {
    return TEACHER_ASSIGNMENT_TYPES.CLASS;
  }

  return VALID_TEACHER_ASSIGNMENT_TYPES.includes(assignmentType)
    ? assignmentType
    : "";
};

const getTeacherAssignmentType = (teacher = {}) =>
  normalizeTeacherAssignmentType(teacher.assignment_type) ||
  TEACHER_ASSIGNMENT_TYPES.FORM;

const isFormTeacher = (teacher = {}) =>
  getTeacherAssignmentType(teacher) === TEACHER_ASSIGNMENT_TYPES.FORM;

const getRecordId = (record) => {
  if (!record) {
    return "";
  }

  if (record._id) {
    return record._id.toString();
  }

  return record.toString();
};

const buildTeacherAssignment = (assignment = {}) => ({
  assigned_class: assignment.assigned_class || "",
  assigned_class_record: assignment.assigned_class_record || null,
  assignment_type: getTeacherAssignmentType(assignment),
  session: assignment.session || "",
  status: assignment.status || "",
  ended_at: assignment.ended_at || null
});

const getTeacherAssignments = (teacher = {}) => {
  teacher = teacher || {};
  const assignments = [];

  if (teacher.assigned_class_record || teacher.assigned_class || teacher.session) {
    assignments.push(
      buildTeacherAssignment({
        assigned_class: teacher.assigned_class,
        assigned_class_record: teacher.assigned_class_record,
        assignment_type: teacher.assignment_type,
        session: teacher.session,
        status: teacher.status
      })
    );
  }

  if (Array.isArray(teacher.assignment_history)) {
    teacher.assignment_history.forEach((assignment) => {
      assignments.push(buildTeacherAssignment(assignment));
    });
  }

  return assignments;
};

const getTeacherAssignmentForSessionClass = (
  teacher = {},
  { session = "", classRecordId = "", assignmentType = TEACHER_ASSIGNMENT_TYPES.FORM } = {}
) => {
  const normalizedAssignmentType =
    normalizeTeacherAssignmentType(assignmentType) ||
    TEACHER_ASSIGNMENT_TYPES.FORM;
  const normalizedClassRecordId = getRecordId(classRecordId);

  return getTeacherAssignments(teacher).find((assignment) => {
    const assignmentClassRecordId = getRecordId(assignment.assigned_class_record);

    return (
      assignment.session === session &&
      assignmentClassRecordId === normalizedClassRecordId &&
      getTeacherAssignmentType(assignment) === normalizedAssignmentType
    );
  });
};

const getTeacherAssignmentForSession = (
  teacher = {},
  { session = "", assignmentType = TEACHER_ASSIGNMENT_TYPES.FORM } = {}
) => {
  const normalizedAssignmentType =
    normalizeTeacherAssignmentType(assignmentType) ||
    TEACHER_ASSIGNMENT_TYPES.FORM;

  return getTeacherAssignments(teacher).find(
    (assignment) =>
      assignment.session === session &&
      getTeacherAssignmentType(assignment) === normalizedAssignmentType &&
      Boolean(getRecordId(assignment.assigned_class_record))
  );
};

const canUseAssignmentTypeForClass = (assignmentType, classRecord) => {
  const normalizedAssignmentType =
    normalizeTeacherAssignmentType(assignmentType) ||
    TEACHER_ASSIGNMENT_TYPES.FORM;

  return (
    normalizedAssignmentType === TEACHER_ASSIGNMENT_TYPES.FORM ||
    isSecondaryClass(classRecord)
  );
};

const formatTeacherAssignmentType = (assignmentType = "") =>
  TEACHER_ASSIGNMENT_LABELS[
    normalizeTeacherAssignmentType(assignmentType) ||
      TEACHER_ASSIGNMENT_TYPES.FORM
  ];

module.exports = {
  TEACHER_ASSIGNMENT_LABELS,
  TEACHER_ASSIGNMENT_TYPES,
  VALID_TEACHER_ASSIGNMENT_TYPES,
  canUseAssignmentTypeForClass,
  formatTeacherAssignmentType,
  getTeacherAssignmentForSession,
  getTeacherAssignmentForSessionClass,
  getTeacherAssignments,
  getTeacherAssignmentType,
  isFormTeacher,
  normalizeTeacherAssignmentType
};
