const Class = require("../models/classModel");
const Teacher = require("../models/teacherModel");
const ClassScheme = require("../models/classSchemeModel");
const { uploadPdfBuffer, getPdfStorageFields, deletePdfFile } = require("../utils/pdfStorage");

const isPdfBuffer = (buffer) => buffer?.subarray(0, 4).toString() === "%PDF";
const parseSubjects = (value = "") => [...new Set(value.split(/[\n,]/).map((subject) => subject.trim()).filter(Boolean))];

const getSchemes = async (req, res) => {
  try {
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findById(req.user.id).populate("assigned_class_record");
      if (!teacher?.assigned_class_record || teacher.status !== "active") return res.json([]);
      return res.json(await ClassScheme.find({ class_record: teacher.assigned_class_record._id, session: teacher.assigned_class_record.session, status: "approved" }));
    }
    res.json(await ClassScheme.find({ status: "approved" }).populate("class_record", "name session").sort({ session: -1 }));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const uploadScheme = async (req, res) => {
  let upload;
  try {
    const { class_record, session, subjects } = req.body;
    if (!req.file || !isPdfBuffer(req.file.buffer)) return res.status(400).json({ message: "A valid PDF scheme of work is required" });
    const classRecord = await Class.findById(class_record);
    const parsedSubjects = parseSubjects(subjects);
    if (!classRecord || classRecord.session !== session) return res.status(400).json({ message: "Select an existing class for the selected session" });
    if (!parsedSubjects.length) return res.status(400).json({ message: "Enter the subjects contained in the PDF" });
    const existingScheme = await ClassScheme.findOne({ class_record: classRecord._id, session });
    upload = await uploadPdfBuffer(req.file.buffer, { fileName: `${classRecord.name}-${session}-scheme-of-work.pdf`, contentType: req.file.mimetype, metadata: { type: "class-scheme-of-work", session, class_record: classRecord._id.toString() } });
    const scheme = await ClassScheme.findOneAndUpdate({ class_record: classRecord._id, session }, { class: classRecord.name, subjects: parsedSubjects, uploaded_by: req.user.id, status: "approved", ...getPdfStorageFields(upload, { contentType: req.file.mimetype }) }, { new: true, upsert: true, runValidators: true });
    if (existingScheme?.pdf_file_id || existingScheme?.pdf_file_key) {
      await deletePdfFile(existingScheme).catch(() => {});
    }
    res.status(201).json(scheme);
  } catch (error) { if (upload) await deletePdfFile(upload).catch(() => {}); res.status(500).json({ error: error.message }); }
};
module.exports = { getSchemes, uploadScheme };
