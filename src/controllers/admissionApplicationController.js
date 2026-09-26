const bcrypt = require("bcryptjs");
const AdmissionApplication = require("../models/admissionApplicationModel");
const AdmissionApplicationSequence = require("../models/admissionApplicationSequenceModel");
const AcademicSessionSetting = require("../models/academicSessionSettingModel");
const Class = require("../models/classModel");
const Student = require("../models/studentModel");
const { generateAdmissionNumber, getSessionEndingYear } = require("../utils/admissionNumbers");
const { VALID_FEE_CATEGORIES, normalizeFeeCategory } = require("../utils/feeCategories");

const SESSION_KEY = "active_academic_session";
const validTerms = ["First Term", "Second Term", "Third Term"];
const reviewStatuses = ["under_review", "contacted", "approved", "rejected", "waitlisted", "withdrawn"];

const createApplicationReference = async (session) => {
  const sequence = await AdmissionApplicationSequence.findOneAndUpdate(
    { session },
    { $inc: { last_serial: 1 }, $setOnInsert: { session } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `GCIS/APP/${getSessionEndingYear(session)}/${String(sequence.last_serial).padStart(4, "0")}`;
};

const getPublicAdmissionOptions = async (req, res) => {
  try {
    const setting = await AcademicSessionSetting.findOne({ key: SESSION_KEY }).lean();
    const activeSession = setting?.active_session || "";
    const classes = activeSession
      ? await Class.find({ session: activeSession }).select("name session section").sort({ name: 1 }).lean()
      : [];
    res.json({ active_session: activeSession, classes });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const submitApplication = async (req, res) => {
  try {
    const { full_name, date_of_birth, gender, parent_name, parent_phone, parent_email, address, applying_session, admission_category = "regular", boarding_requested = false, preferred_class, previous_school, support_notes, consent_given } = req.body;
    const setting = await AcademicSessionSetting.findOne({ key: SESSION_KEY }).lean();
    const activeSession = setting?.active_session || "";
    const session = applying_session?.toString().trim() || activeSession;

    if (!activeSession) return res.status(503).json({ message: "Admissions are not open yet. Please contact the school." });
    if (session !== activeSession) return res.status(400).json({ message: "Applications are currently open for the active academic session only" });
    if (!["regular", "vip", "scholarship"].includes(admission_category)) return res.status(400).json({ message: "Select a valid admission category" });
    if (!full_name?.trim() || !date_of_birth || !["Male", "Female"].includes(gender) || !parent_name?.trim() || !parent_phone?.trim() || consent_given !== true) {
      return res.status(400).json({ message: "Child details, parent details, and consent are required" });
    }
    if (Number.isNaN(new Date(date_of_birth).getTime())) return res.status(400).json({ message: "Enter a valid date of birth" });
    let preferredClass = null;
    if (preferred_class) {
      preferredClass = await Class.findOne({ _id: preferred_class, session });
      if (!preferredClass) return res.status(400).json({ message: "Select a valid class for the application session" });
    }
    const duplicate = await AdmissionApplication.findOne({
      parent_phone: parent_phone.trim(), full_name: full_name.trim(), date_of_birth: new Date(date_of_birth),
      status: { $nin: ["rejected", "withdrawn"] }
    });
    if (duplicate) return res.status(409).json({ message: "An application matching these child and parent details already exists", application_reference: duplicate.application_reference });

    const application = await AdmissionApplication.create({
      application_reference: await createApplicationReference(session), full_name, date_of_birth, gender,
      parent_name, parent_phone, parent_email, address, applying_session: session, admission_category, boarding_requested: boarding_requested === true,
      preferred_class: preferredClass?._id || null, previous_school, support_notes, consent_given: true,
      submitted_ip: req.ip
    });
    res.status(201).json({ application_reference: application.application_reference, message: "Application submitted successfully. Keep your application reference for school follow-up." });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const trackApplication = async (req, res) => {
  try {
    const reference = req.body.application_reference?.toString().trim();
    const phone = req.body.parent_phone?.toString().trim();
    if (!reference || !phone) return res.status(400).json({ message: "Application reference and parent phone number are required" });
    const application = await AdmissionApplication.findOne({ application_reference: reference, parent_phone: phone }).select("application_reference applying_session status createdAt converted_student").populate("converted_student", "admission_no").lean();
    if (!application) return res.status(404).json({ message: "No matching application was found" });
    res.json({ application_reference: application.application_reference, applying_session: application.applying_session, status: application.status, submitted_at: application.createdAt, admission_no: application.converted_student?.admission_no || "" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const listApplications = async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.session) query.applying_session = req.query.session;
    if (req.query.search) query.$or = [
      { full_name: { $regex: req.query.search, $options: "i" } },
      { parent_name: { $regex: req.query.search, $options: "i" } },
      { parent_phone: { $regex: req.query.search, $options: "i" } },
      { application_reference: { $regex: req.query.search, $options: "i" } }
    ];
    res.json(await AdmissionApplication.find(query).populate("preferred_class", "name session").populate("converted_student", "full_name admission_no class").sort({ createdAt: -1 }));
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getApplicationForRegistration = async (req, res) => {
  try {
    const application = await AdmissionApplication.findOne({
      _id: req.params.id,
      status: "approved",
      converted_student: null
    })
      .populate("preferred_class", "name session")
      .lean();

    if (!application) {
      return res.status(404).json({
        message: "This application is not approved for registration or has already been converted"
      });
    }

    return res.json(application);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { status, admin_note = "" } = req.body;
    if (!reviewStatuses.includes(status)) return res.status(400).json({ message: "Invalid application status" });
    const application = await AdmissionApplication.findOneAndUpdate(
      { _id: req.params.id, converted_student: null },
      { status, admin_note, reviewed_by: req.user.id, reviewed_at: new Date() }, { new: true }
    );
    if (!application) return res.status(404).json({ message: "Application not found or has already been converted" });
    res.json(application);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const convertApplication = async (req, res) => {
  try {
    const { class_record, password, admission_term } = req.body;
    if (!class_record || !password || password.length < 6 || !validTerms.includes(admission_term)) {
      return res.status(400).json({ message: "Class, a password of at least 6 characters, and admission term are required" });
    }
    const application = await AdmissionApplication.findOneAndUpdate(
      { _id: req.params.id, status: "approved", conversion_state: "ready", converted_student: null },
      { conversion_state: "converting" }, { new: true }
    );
    if (!application) return res.status(400).json({ message: "Only an approved application that has not been converted can create a student" });
    try {
      const selectedClass = await Class.findById(class_record);
      if (!selectedClass || selectedClass.session !== application.applying_session) throw new Error("Final class must belong to the application session");
      const feeCategoryByAdmissionCategory = { regular: "new", vip: "vip", scholarship: "scholarship" };
      const feeCategory = feeCategoryByAdmissionCategory[
        application.admission_category || "regular"
      ];
      if (!VALID_FEE_CATEGORIES.includes(normalizeFeeCategory(feeCategory))) throw new Error("Application has an invalid admission category");
      const hashedPassword = await bcrypt.hash(password, 10);
      const student = await Student.create({
        full_name: application.full_name, admission_no: await generateAdmissionNumber(selectedClass.session),
        admission_application: application._id, class: selectedClass.name, class_record: selectedClass._id,
        current_session: selectedClass.session, gender: application.gender, password: hashedPassword, initial_password: hashedPassword,
        class_enrollments: [{ session: selectedClass.session, class_record: selectedClass._id, class: selectedClass.name }],
        fee_enrollments: [{ session: selectedClass.session, term: admission_term, fee_category: feeCategory, class_record: selectedClass._id, class: selectedClass.name }]
      });
      application.converted_student = student._id;
      application.status = "converted_to_student";
      application.conversion_state = "converted";
      application.reviewed_by = req.user.id;
      application.reviewed_at = new Date();
      await application.save();
      return res.status(201).json({ student: { _id: student._id, full_name: student.full_name, admission_no: student.admission_no }, application });
    } catch (error) {
      application.conversion_state = "ready";
      await application.save();
      throw error;
    }
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = { getPublicAdmissionOptions, submitApplication, trackApplication, listApplications, getApplicationForRegistration, updateApplicationStatus, convertApplication };
