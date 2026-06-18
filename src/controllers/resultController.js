const Result = require("../models/resultModel");

const Student = require("../models/studentModel");

const ResultAccess = require("../models/resultAccessModel");
const Class = require("../models/classModel");
const {
  deletePdfFile,
  getPdfStorageFields,
  sendPdfFile,
  uploadPdfBuffer
} = require("../utils/pdfStorage");
const {
  applyListQueryOptions,
  getListQueryOptions
} = require("../utils/listQueryOptions");
const {
  studentBelongsToTermClass
} = require("../utils/studentTermEnrollment");

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
      storage: result.pdf_storage,
      fileId: result.pdf_file_id,
      fileKey: result.pdf_file_key,
      legacyFileId: result.legacy_pdf_file_id,
      bucket: result.pdf_bucket,
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
      class_record,
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

    const [student, selectedClass] = await Promise.all([
      Student.findById(studentId).populate("fee_enrollments.class_record"),
      class_record ? Class.findById(class_record) : null
    ]);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    if (!selectedClass) {
      return res.status(400).json({
        message: "Class record is required"
      });
    }

    if (
      !studentBelongsToTermClass({
        student,
        classRecord: selectedClass,
        session,
        term
      })
    ) {
      return res.status(400).json({
        message:
          "Student is not enrolled in this class for the selected session and term"
      });
    }

    const resultClass = studentClass || selectedClass.name;

    const fileName = createSafeFileName(
      student.full_name,
      term,
      session
    );

    const pdfUpload = await uploadPdfBuffer(req.file.buffer, {
      fileName,
      contentType: req.file.mimetype,
      metadata: {
        type: "termly-result",
        student: studentId,
        session,
        term,
        class: resultClass,
        class_record
      }
    });

    let result;

    try {
      result = await Result.create({
        student: studentId,
        session,
        term,
        class: resultClass,
        ...getPdfStorageFields(pdfUpload, {
          contentType: req.file.mimetype,
          fileName
        })
      });
    } catch (error) {
      await deletePdfFile(pdfUpload);
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
      class: studentClass,
      class_record
    } = req.body;

    const targetStudentId = studentId || result.student;
    const [student, selectedClass] = await Promise.all([
      Student.findById(targetStudentId).populate("fee_enrollments.class_record"),
      class_record ? Class.findById(class_record) : null
    ]);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const nextSession = session || result.session;
    const nextTerm = term || result.term;
    const nextClass = studentClass || selectedClass?.name || result.class;

    if (class_record && !selectedClass) {
      return res.status(400).json({
        message: "Class record is required"
      });
    }

    if (
      selectedClass &&
      !studentBelongsToTermClass({
        student,
        classRecord: selectedClass,
        session: nextSession,
        term: nextTerm
      })
    ) {
      return res.status(400).json({
        message:
          "Student is not enrolled in this class for the selected session and term"
      });
    }
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

    let previousPdfFile = null;

    if (req.file) {
      if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({
          message: "Invalid PDF file"
        });
      }

      previousPdfFile = result.toObject();
      const pdfUpload = await uploadPdfBuffer(req.file.buffer, {
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

      Object.assign(
        result,
        getPdfStorageFields(pdfUpload, {
          contentType: req.file.mimetype,
          fileName
        })
      );
      result.pdf_data = undefined;
      result.legacy_pdf_file_id = undefined;
    }

    const updatedResult = await result.save();
    await deletePdfFile(previousPdfFile);

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

    await result.deleteOne();
    await deletePdfFile(result);

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
