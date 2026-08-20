const CurriculumEntry = require("../models/curriculumEntryModel");
const AcademicTemplate = require("../models/academicTemplateModel");
const AcademicDocument = require("../models/academicDocumentModel");
const ClassScheme = require("../models/classSchemeModel");
const Teacher = require("../models/teacherModel");
const { readPdfBuffer } = require("../utils/pdfStorage");

const documentTypes = ["lesson_note", "assignment", "test", "examination"];

const getCurricula = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { status: "approved" };
    ["level", "class_name", "subject", "session", "term", "status"].forEach((field) => {
      if (req.query[field]) query[field] = req.query[field];
    });
    res.json(await CurriculumEntry.find(query).sort({ session: -1, createdAt: -1 }));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createCurriculum = async (req, res) => {
  try {
    const { level, class_name, subject, session, term, week, topic, learning_objectives = [], content, source_title, status } = req.body;
    if (!level || !class_name || !subject || !session || !term || !week || !topic || !content) {
      return res.status(400).json({ message: "Level, class, subject, session, term, week, topic, and scheme content are required" });
    }
    const entry = await CurriculumEntry.create({ level, class_name, subject, session, term, week, topic, learning_objectives, content, source_title, status, created_by: req.user.id });
    res.status(201).json(entry);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const updateCurriculum = async (req, res) => {
  try {
    const entry = await CurriculumEntry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ message: "Curriculum entry not found" });
    res.json(entry);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getTemplates = async (req, res) => {
  try { res.json(await AcademicTemplate.find({ is_active: true }).sort({ document_type: 1, name: 1 })); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

const createTemplate = async (req, res) => {
  try {
    const { name, document_type, header_text, instructions, sections = [] } = req.body;
    if (!name || !documentTypes.includes(document_type) || !header_text) return res.status(400).json({ message: "Name, valid document type, and header text are required" });
    res.status(201).json(await AcademicTemplate.create({ name, document_type, header_text, instructions, sections, created_by: req.user.id }));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getDocuments = async (req, res) => {
  try {
    const query = req.user.role === "teacher" ? { teacher: req.user.id } : {};
    if (req.query.status) query.status = req.query.status;
    res.json(await AcademicDocument.find(query).populate("curriculum_entry", "class_name subject term week topic").populate("class_scheme", "class session subjects file_name").populate("template", "name header_text").populate("teacher", "full_name").sort({ createdAt: -1 }));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const generateDocument = async (req, res) => {
  try {
    const { class_scheme, subject, template, document_type, question_count = 10, duration_minutes = 40, difficulty = "mixed" } = req.body;
    if (!class_scheme || !subject || !documentTypes.includes(document_type)) return res.status(400).json({ message: "Class scheme, subject, and a valid document type are required" });
    const teacher = await Teacher.findById(req.user.id).populate("assigned_class_record");
    const scheme = await ClassScheme.findOne({ _id: class_scheme, status: "approved" });
    if (!teacher?.assigned_class_record || !scheme || scheme.class_record.toString() !== teacher.assigned_class_record._id.toString() || scheme.session !== teacher.assigned_class_record.session) return res.status(403).json({ message: "This scheme is not assigned to your active class" });
    const selectedSubject = scheme.subjects.find((item) => item.toLowerCase() === subject.toLowerCase());
    if (!selectedSubject) return res.status(400).json({ message: "Select a subject included in the approved scheme" });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ message: "AI generation is not configured. Add OPENAI_API_KEY to the backend environment." });
    const selectedTemplate = template ? await AcademicTemplate.findOne({ _id: template, is_active: true }) : null;
    const schemePdf = await readPdfBuffer(scheme);
    const prompt = `Return valid JSON only. Create a professional ${document_type} for ${scheme.class}, ${scheme.session}, subject: ${selectedSubject}. Use the attached approved school scheme of work as the only curriculum source. Use ${question_count} questions, ${duration_minutes} minutes, ${difficulty} difficulty. Apply this school header: ${selectedTemplate?.header_text || "Golden Castle School"}. Required template sections: ${(selectedTemplate?.sections || []).join(", ")}. Include a marking scheme and a diagram_description only when useful. Do not claim official WAEC/BECE approval.`;
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5", input: [{ role: "user", content: [{ type: "input_file", filename: scheme.file_name || "scheme-of-work.pdf", file_data: `data:application/pdf;base64,${schemePdf.toString("base64")}` }, { type: "input_text", text: prompt }] }] }) });
    if (!response.ok) return res.status(502).json({ message: "AI generation failed", error: await response.text() });
    const payload = await response.json();
    let content;
    try { content = JSON.parse(payload.output_text); } catch { content = { body: payload.output_text }; }
    const document = await AcademicDocument.create({ title: content.title || `${selectedSubject} ${document_type}`, document_type, class_scheme: scheme._id, subject: selectedSubject, template: selectedTemplate?._id || null, teacher: req.user.id, generation_request: { question_count, duration_minutes, difficulty }, content });
    res.status(201).json(document);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const reviewDocument = async (req, res) => {
  try {
    const { status, review_note = "" } = req.body;
    if (!["draft", "in_review", "approved"].includes(status)) return res.status(400).json({ message: "Invalid document status" });
    const document = await AcademicDocument.findByIdAndUpdate(req.params.id, { status, review_note, reviewed_by: req.user.id, reviewed_at: new Date() }, { new: true });
    if (!document) return res.status(404).json({ message: "Document not found" });
    res.json(document);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = { getCurricula, createCurriculum, updateCurriculum, getTemplates, createTemplate, getDocuments, generateDocument, reviewDocument };
