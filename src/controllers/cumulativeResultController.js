const CumulativeResult = require("../models/cumulativeResultModel");
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
  return `${parts.filter(Boolean).join("-")}-cumulative-result.pdf`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const isPdfBuffer = (buffer) => {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString() === "%PDF";
};

const buildCumulativeResultQuery = () =>
  CumulativeResult.find({
    $or: [
      { pdf_file_id: { $exists: true } },
      { pdf_data: { $exists: true } }
    ]
  }).select("-pdf_data");

const enforceCumulativeResultAccess = async (req, result) => {
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
      !access?.cumulative_session ||
      result.session !== access.cumulative_session
    ) {
      return {
        allowed: false,
        status: 403,
        message: "This cumulative result is not currently available"
      };
    }
  }

  return {
    allowed: true
  };
};

const sendCumulativeResultPdf = async (req, res, dispositionType) => {
  try {
    const result = await CumulativeResult.findById(
      req.params.resultId
    ).populate("student", "full_name admission_no");

    if (!result) {
      return res.status(404).json({
        message: "Cumulative result not found"
      });
    }

    const access = await enforceCumulativeResultAccess(req, result);

    if (!access.allowed) {
      return res.status(access.status).json({
        message: access.message
      });
    }

    return sendPdfFile({
      res,
      fileId: result.pdf_file_id,
      fallbackBuffer: result.pdf_data,
      fileName: result.file_name,
      contentType: result.pdf_mime_type,
      dispositionType,
      unavailableMessage: "Cumulative result PDF file is not available."
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};

const uploadCumulativeResult = async (req, res) => {
  try {
    const {
      studentId,
      session,
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

    if (!studentId || !session || !studentClass) {
      return res.status(400).json({
        message: "Student, session, and class are required"
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
      session
    );

    const pdfFileId = await uploadPdfBuffer(req.file.buffer, {
      fileName,
      contentType: req.file.mimetype,
      metadata: {
        type: "cumulative-result",
        student: studentId,
        session,
        class: studentClass
      }
    });

    let result;

    try {
      result = await CumulativeResult.create({
        student: studentId,
        session,
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

const getAllCumulativeResults = async (req, res) => {
  try {
    const query = buildCumulativeResultQuery()
      .populate("student", "full_name admission_no class current_session")
      .sort({
        createdAt: -1
      });
    const results = await applyListQueryOptions(
      query,
      getListQueryOptions(req.query)
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getStudentCumulativeResults = async (req, res) => {
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
        student: studentId,
        $or: [
          { pdf_file_id: { $exists: true } },
          { pdf_data: { $exists: true } }
        ]
      };

    if (req.user.role === "student") {
      const access = await ResultAccess.findOne({
        key: "active-result-access"
      });

      if (!access?.cumulative_session) {
        return res.json([]);
      }

      query.session = access.cumulative_session;
    }

    const results = await CumulativeResult.find(query)
      .select("-pdf_data")
      .sort({
        createdAt: -1
      });

    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateCumulativeResult = async (req, res) => {
  try {
    const result = await CumulativeResult.findById(req.params.resultId);

    if (!result) {
      return res.status(404).json({
        message: "Cumulative result not found"
      });
    }

    const {
      studentId,
      session,
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
    const nextClass = studentClass || result.class;
    const fileName = createSafeFileName(
      student.full_name,
      nextSession
    );

    result.student = targetStudentId;
    result.session = nextSession;
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
          type: "cumulative-result",
          student: targetStudentId.toString(),
          session: nextSession,
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

const deleteCumulativeResult = async (req, res) => {
  try {
    const result = await CumulativeResult.findById(req.params.resultId);

    if (!result) {
      return res.status(404).json({
        message: "Cumulative result not found"
      });
    }

    const pdfFileId = result.pdf_file_id;

    await result.deleteOne();
    await deletePdfFile(pdfFileId);

    res.json({
      message: "Cumulative result deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const viewCumulativeResult = (req, res) =>
  sendCumulativeResultPdf(req, res, "inline");

const downloadCumulativeResult = (req, res) =>
  sendCumulativeResultPdf(req, res, "attachment");

module.exports = {
  uploadCumulativeResult,
  getAllCumulativeResults,
  getStudentCumulativeResults,
  updateCumulativeResult,
  deleteCumulativeResult,
  viewCumulativeResult,
  downloadCumulativeResult
};
