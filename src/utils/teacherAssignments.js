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
  getTeacherAssignmentType,
  isFormTeacher,
  normalizeTeacherAssignmentType
};
