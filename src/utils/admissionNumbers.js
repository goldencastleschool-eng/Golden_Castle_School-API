const AdmissionSequence = require("../models/admissionSequenceModel");
const Student = require("../models/studentModel");

const ADMISSION_PREFIX = "GCIS";
const SESSION_PATTERN = /^(\d{4})\s*\/\s*(\d{4})$/;

const getSessionEndingYear = (session = "") => {
  const match = session.toString().trim().match(SESSION_PATTERN);

  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    return "";
  }

  return match[2].slice(-2);
};

const formatAdmissionNumber = (session, serial) => {
  const endingYear = getSessionEndingYear(session);

  if (!endingYear) {
    return "";
  }

  return `${ADMISSION_PREFIX}/${endingYear}/${String(serial).padStart(4, "0")}`;
};

const getHighestExistingSerial = async (session) => {
  const endingYear = getSessionEndingYear(session);

  if (!endingYear) {
    return 0;
  }

  const prefix = `${ADMISSION_PREFIX}/${endingYear}/`;
  const students = await Student.find({
    admission_no: { $regex: `^${prefix}(\\d+)$` }
  }).select("admission_no").lean();

  return students.reduce((highestSerial, student) => {
    const serial = Number(student.admission_no.slice(prefix.length));

    return Number.isSafeInteger(serial) && serial > highestSerial
      ? serial
      : highestSerial;
  }, 0);
};

const ensureSequence = async (session) => {
  const existingSequence = await AdmissionSequence.findOne({ session });

  if (existingSequence) {
    return;
  }

  const lastSerial = await getHighestExistingSerial(session);

  try {
    await AdmissionSequence.create({
      session,
      last_serial: lastSerial
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
};

const generateAdmissionNumber = async (session) => {
  const normalizedSession = session?.toString().trim();

  if (!getSessionEndingYear(normalizedSession)) {
    throw new Error("Academic session must use the format YYYY/YYYY, such as 2026/2027");
  }

  await ensureSequence(normalizedSession);

  const sequence = await AdmissionSequence.findOneAndUpdate(
    { session: normalizedSession },
    { $inc: { last_serial: 1 } },
    { new: true }
  );

  if (!sequence) {
    throw new Error("Unable to generate an admission number");
  }

  return formatAdmissionNumber(normalizedSession, sequence.last_serial);
};

module.exports = {
  formatAdmissionNumber,
  generateAdmissionNumber,
  getSessionEndingYear
};
