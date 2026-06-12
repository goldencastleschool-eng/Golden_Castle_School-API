const Class = require("../models/classModel");
const Result = require("../models/resultModel");
const Student = require("../models/studentModel");
const {
  inferClassSection,
  normalizeClassSection
} = require("./classSections");

const normalizeClassName = (name = "") =>
  name.toString().trim().toLowerCase().replace(/\s+/g, "");

const normalizeSession = (session = "") =>
  session.toString().trim();

const ensureDynamicClassIndexes = async () => {
  const indexes = await Class.collection.indexes();
  const legacyNameIndex = indexes.find(
    (index) => index.name === "name_1" && index.unique
  );

  if (legacyNameIndex) {
    await Class.collection.dropIndex("name_1");
  }

  await Class.syncIndexes();
};

const findClassRecord = async (name, session) => {
  return Class.findOne({
    name: normalizeClassName(name),
    session: normalizeSession(session)
  });
};

const ensureClassRecord = async (name, session, section = "") => {
  const normalizedName = normalizeClassName(name);
  const normalizedSession = normalizeSession(session);
  const normalizedSection =
    normalizeClassSection(section) || inferClassSection(normalizedName);

  if (!normalizedName || !normalizedSession) {
    return null;
  }

  await ensureDynamicClassIndexes();

  const existingClass = await findClassRecord(
    normalizedName,
    normalizedSession
  );

  if (existingClass) {
    if (!existingClass.section && normalizedSection) {
      existingClass.section = normalizedSection;
      await existingClass.save();
    }

    return existingClass;
  }

  try {
    return await Class.create({
      name: normalizedName,
      session: normalizedSession,
      ...(normalizedSection ? { section: normalizedSection } : {})
    });
  } catch (error) {
    if (error.code === 11000) {
      return findClassRecord(normalizedName, normalizedSession);
    }

    throw error;
  }
};

const deleteStaticClassRecords = async () => {
  await Class.deleteMany({
    $or: [
      { session: { $exists: false } },
      { session: null },
      { session: "" }
    ]
  });
};

const syncLegacyClassesToDynamicRecords = async () => {
  await ensureDynamicClassIndexes();

  const students = await Student.find({
    class: { $exists: true, $ne: "" },
    current_session: { $exists: true, $ne: "" }
  }).select("_id class current_session class_record");

  for (const student of students) {
    const classRecord = await ensureClassRecord(
      student.class,
      student.current_session
    );

    if (
      classRecord &&
      (!student.class_record ||
        student.class_record.toString() !== classRecord._id.toString())
    ) {
      student.class_record = classRecord._id;
      await student.save();
    }
  }

  const results = await Result.find({
    class: { $exists: true, $ne: "" },
    session: { $exists: true, $ne: "" }
  }).select("class session");

  for (const result of results) {
    await ensureClassRecord(result.class, result.session);
  }

  await deleteStaticClassRecords();
};

module.exports = {
  deleteStaticClassRecords,
  ensureClassRecord,
  findClassRecord,
  normalizeClassName,
  normalizeSession,
  syncLegacyClassesToDynamicRecords
};
