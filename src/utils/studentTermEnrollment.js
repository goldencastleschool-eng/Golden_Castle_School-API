const getRecordId = (record) => {
  if (!record) {
    return "";
  }

  if (record._id) {
    return record._id.toString();
  }

  return record.toString();
};

const normalizeClassName = (className = "") =>
  className.toString().trim().toLowerCase().replace(/\s+/g, "");

const TERM_ORDER = ["First Term", "Second Term", "Third Term"];

const getTermIndex = (term = "") => {
  const termIndex = TERM_ORDER.indexOf(term);

  return termIndex === -1 ? TERM_ORDER.length : termIndex;
};

const getStudentTermEnrollment = (student = {}, session = "", term = "") => {
  const enrollments = Array.isArray(student.fee_enrollments)
    ? student.fee_enrollments
    : [];

  return enrollments.find(
    (enrollment) =>
      enrollment.session === session &&
      enrollment.term === term
  );
};

const getStudentEffectiveTermEnrollment = (
  student = {},
  session = "",
  term = ""
) => {
  const enrollments = Array.isArray(student.fee_enrollments)
    ? student.fee_enrollments
    : [];
  const targetTermIndex = getTermIndex(term);

  return enrollments
    .filter((enrollment) => {
      if (enrollment.session !== session) {
        return false;
      }

      return getTermIndex(enrollment.term) <= targetTermIndex;
    })
    .sort(
      (firstEnrollment, secondEnrollment) =>
        getTermIndex(secondEnrollment.term) - getTermIndex(firstEnrollment.term)
    )[0];
};

const studentBelongsToTermClass = ({
  student,
  classRecord,
  session,
  term
}) => {
  const enrollment = getStudentEffectiveTermEnrollment(student, session, term);

  if (!enrollment || !classRecord) {
    return false;
  }

  const enrollmentClassId = getRecordId(enrollment.class_record);
  const classRecordId = getRecordId(classRecord);

  return (
    (enrollmentClassId && enrollmentClassId === classRecordId) ||
    normalizeClassName(enrollment.class) === normalizeClassName(classRecord.name)
  );
};

module.exports = {
  getRecordId,
  getStudentEffectiveTermEnrollment,
  getStudentTermEnrollment,
  normalizeClassName,
  studentBelongsToTermClass
};
