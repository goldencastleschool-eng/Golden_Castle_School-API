const Result = require("../models/resultModel");

const Student = require("../models/studentModel");

const ResultAccess = require("../models/resultAccessModel");
const {
  deletePdfFile,
  sendPdfFile,
  uploadPdfBuffer
} = require("../utils/pdfStorage");
const {
  applyListQueryOptions,
  getListQueryOptions
} = require("../utils/listQueryOptions");

const createSafeFileName = (...parts) => {
  return `${parts.filter(Boolean).join("-")}-result.pdf`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const isPdfBuffer = (buffer) => {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString() === "%PDF";
};

const resultFileQuery = {
  $or: [
    { pdf_file_id: { $exists: true } },
    { pdf_data: { $exists: true } }
  ]
};

const buildResultQuery = () =>
  Result.find(resultFileQuery).select("-pdf_data");

const buildStudentResultQuery = (query) =>
  Result.find({
    ...query,
    $or: [
      { pdf_file_id: { $exists: true } },
      { pdf_data: { $exists: true } }
    ]
  }).select("-pdf_data");

const enforceResultAccess = async (req, result) => {
  if (
    req.user.role === "student" &&
    result.student._id.toString() !== req.user.id
  ) {
    return {
      allowed: false,
      status: 403,
      message: "Access denied"
    };
  }

  if (req.user.role === "student") {
    const access = await ResultAccess.findOne({
      key: "active-result-access"
    });

    if (
      !access?.session ||
      !access?.term ||
      result.session !== access.session ||
      result.term !== access.term
    ) {
      return {
        allowed: false,
        status: 403,
        message: "This result is not currently available"
      };
    }
  }

  return {
    allowed: true
  };
};

const sendResultPdf = async (req, res, dispositionType) => {
  try {
    const result = await Result.findById(
      req.params.resultId
    ).populate(
      "student",
      "full_name admission_no"
    );

    if (!result) {
      return res.status(404).json({
        message: "Result not found"
      });
    }

    const access = await enforceResultAccess(req, result);

    if (!access.allowed) {
      return res.status(access.status).json({
        message: access.message
      });
    }

    const fileName = result.file_name || createSafeFileName(
      result.student?.full_name,
      result.term,
      result.session
    );

    return sendPdfFile({
      res,
      fileId: result.pdf_file_id,
      fallbackBuffer: result.pdf_data,
      fileName,
      contentType: result.pdf_mime_type,
      dispositionType,
      unavailableMessage: "Result PDF file is not available. Please re-upload this result."
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};


// UPLOAD RESULT
const uploadResult = async (req, res) => {

  try {

    const {
      studentId,
      session,
      term,
      class: studentClass
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        message: "PDF file required"
      });
    }

    if (!isPdfBuffer(req.file.buffer)) {
      return res.status(400).json({
        message: "Invalid PDF file"
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const fileName = createSafeFileName(
      student.full_name,
      term,
      session
    );

    const pdfFileId = await uploadPdfBuffer(req.file.buffer, {
      fileName,
      contentType: req.file.mimetype,
      metadata: {
        type: "termly-result",
        student: studentId,
        session,
        term,
        class: studentClass
      }
    });

    let result;

    try {
      result = await Result.create({
        student: studentId,
        session,
        term,
        class: studentClass,
        pdf_file_id: pdfFileId,
        pdf_mime_type: req.file.mimetype,
        file_name: fileName
      });
    } catch (error) {
      await deletePdfFile(pdfFileId);
      throw error;
    }

    res.status(201).json({
      ...result.toObject(),
      pdf_data: undefined
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
};

// GET ALL RESULTS
const getAllResults = async (req, res) => {

  try {

    const query = buildResultQuery()
      .populate(
        "student",
        "full_name admission_no class"
      )
      .sort({
        createdAt: -1
      });
    const listOptions = getListQueryOptions(req.query);
    const [results, totalCount] = await Promise.all([
      applyListQueryOptions(query, listOptions),
      Result.countDocuments()
    ]);

    res.set("X-Total-Count", totalCount.toString());

    res.json(results);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
};

// GET RESULT COUNT
const getResultCount = async (req, res) => {

  try {

    const totalCount = await Result.countDocuments();

    res.json({
      totalCount
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
};


// GET STUDENT RESULTS
const getStudentResults = async (req, res) => {

  try {

    const studentId = req.params.studentId;

    if (
      req.user.role === "student" &&
      req.user.id !== studentId
    ) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const query = {
      student: studentId
    };

    if (req.user.role === "student") {
      const access = await ResultAccess.findOne({
        key: "active-result-access"
      });

      if (!access?.session || !access?.term) {
        return res.json([]);
      }

      query.session = access.session;
      query.term = access.term;
    }

    const results = await buildStudentResultQuery(query).sort({
      createdAt: -1
    });

    res.json(results);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
};

// UPDATE RESULT
const updateResult = async (req, res) => {

  try {

    const result = await Result.findById(req.params.resultId);

    if (!result) {
      return res.status(404).json({
        message: "Result not found"
      });
    }

    const {
      studentId,
      session,
      term,
      class: studentClass
    } = req.body;

    const targetStudentId = studentId || result.student;
    const student = await Student.findById(targetStudentId);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const nextSession = session || result.session;
    const nextTerm = term || result.term;
    const nextClass = studentClass || result.class;
    const fileName = createSafeFileName(
      student.full_name,
      nextTerm,
      nextSession
    );

    result.student = targetStudentId;
    result.session = nextSession;
    result.term = nextTerm;
    result.class = nextClass;
    result.file_name = fileName;

    let previousPdfFileId = null;

    if (req.file) {
      if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({
          message: "Invalid PDF file"
        });
      }

      previousPdfFileId = result.pdf_file_id;
      const pdfFileId = await uploadPdfBuffer(req.file.buffer, {
        fileName,
        contentType: req.file.mimetype,
        metadata: {
          type: "termly-result",
          student: targetStudentId.toString(),
          session: nextSession,
          term: nextTerm,
          class: nextClass
        }
      });

      result.pdf_file_id = pdfFileId;
      result.pdf_data = undefined;
      result.pdf_mime_type = req.file.mimetype;
    }

    const updatedResult = await result.save();
    await deletePdfFile(previousPdfFileId);

    res.json({
      ...updatedResult.toObject(),
      pdf_data: undefined
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
};

// DELETE RESULT
const deleteResult = async (req, res) => {

  try {

    const result = await Result.findById(req.params.resultId);

    if (!result) {
      return res.status(404).json({
        message: "Result not found"
      });
    }

    const pdfFileId = result.pdf_file_id;

    await result.deleteOne();
    await deletePdfFile(pdfFileId);

    res.json({
      message: "Result deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
};

const viewResult = (req, res) => sendResultPdf(req, res, "inline");

const downloadResult = (req, res) => sendResultPdf(req, res, "attachment");

module.exports = {
  uploadResult,
  getAllResults,
  getResultCount,
  getStudentResults,
  updateResult,
  deleteResult,
  viewResult,
  downloadResult
};
