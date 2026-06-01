const Result = require("../models/resultModel");

const Student = require("../models/studentModel");

const ResultAccess = require("../models/resultAccessModel");

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

const buildResultQuery = () =>
  Result.find({
    pdf_data: { $exists: true }
  }).select("-pdf_data");

const buildStudentResultQuery = (query) =>
  Result.find({
    ...query,
    pdf_data: { $exists: true }
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

    if (!result.pdf_data?.length) {
      return res.status(404).json({
        message: "Result PDF file is not available. Please re-upload this result."
      });
    }

    res.setHeader(
      "Content-Type",
      result.pdf_mime_type || "application/pdf"
    );
    res.setHeader(
      "Content-Disposition",
      `${dispositionType}; filename="${fileName}"`
    );
    res.setHeader(
      "Content-Length",
      result.pdf_data.length
    );

    return res.send(result.pdf_data);

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

    const result = await Result.create({
      student: studentId,
      session,
      term,
      class: studentClass,
      pdf_data: req.file.buffer,
      pdf_mime_type: req.file.mimetype,
      file_name: fileName
    });

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

    const results = await buildResultQuery()
      .populate(
        "student",
        "full_name admission_no class"
      )
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

    if (req.file) {
      if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({
          message: "Invalid PDF file"
        });
      }

      result.pdf_data = req.file.buffer;
      result.pdf_mime_type = req.file.mimetype;
    }

    const updatedResult = await result.save();

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
  getStudentResults,
  updateResult,
  deleteResult,
  viewResult,
  downloadResult
};
