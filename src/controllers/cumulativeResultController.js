const CumulativeResult = require("../models/cumulativeResultModel");
const Class = require("../models/classModel");
const Student = require("../models/studentModel");
const Teacher = require("../models/teacherModel");
const ResultAccess = require("../models/resultAccessModel");
const {
  getTeacherAssignmentForSession,
  getTeacherAssignmentForSessionClass
} = require("../utils/teacherAssignments");
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

const normalizeClassName = (className = "") =>
  className.toString().trim().toLowerCase().replace(/\s+/g, "");

const escapeRegex = (value = "") =>
  value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const enforceCumulativeResultAccess = async (req, result) => {
  if (req.user.role === "admin") {
    return {
      allowed: true
    };
  }

  if (
    req.user.role === "student" &&
    result.student?._id?.toString() !== req.user.id
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

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return {
        allowed: false,
        status: 404,
        message: "Teacher not found"
      };
    }

    if (teacher.status === "inactive") {
      return {
        allowed: false,
        status: 403,
        message: "This teacher account is inactive"
      };
    }

    const access = await ResultAccess.findOne({
      key: "active-result-access"
    });

    const resultClass = normalizeClassName(result.class);
    const resultClassRecordId = result.class_record?.toString();
    const resultTeacherId = result.assigned_teacher?.toString();
    const resultAssignment = resultClassRecordId
      ? getTeacherAssignmentForSessionClass(teacher, {
          session: result.session,
          classRecordId: resultClassRecordId
        })
      : getTeacherAssignmentForSession(teacher, {
          session: result.session
        });
    const teacherClass = normalizeClassName(resultAssignment?.assigned_class);
    const belongsToTeacher =
      resultTeacherId && resultClassRecordId
        ? resultTeacherId === teacher._id.toString() &&
          Boolean(resultAssignment)
        : teacherClass && teacherClass === resultClass;

    if (
      !access?.cumulative_session ||
      result.session !== access.cumulative_session ||
      !belongsToTeacher
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
      storage: result.pdf_storage,
      fileId: result.pdf_file_id,
      fileKey: result.pdf_file_key,
      legacyFileId: result.legacy_pdf_file_id,
      bucket: result.pdf_bucket,
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
      assigned_teacher,
      class_record,
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

    if (!assigned_teacher || !class_record || !session || !studentClass) {
      return res.status(400).json({
        message: "Form teacher, class, and session are required"
      });
    }

    const teacher = await Teacher.findById(assigned_teacher);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    const teacherAssignment = getTeacherAssignmentForSessionClass(teacher, {
      session,
      classRecordId: class_record
    });

    if (
      teacher.status === "inactive" ||
      !teacherAssignment
    ) {
      return res.status(400).json({
        message: "Selected teacher is not the active form teacher for this class and session"
      });
    }

    const fileName = createSafeFileName(
      teacherAssignment.assigned_class || studentClass,
      session
    );

    const existingResult = await CumulativeResult.findOne({
      session,
      class_record,
      assigned_teacher
    });

    if (existingResult) {
      return res.status(409).json({
        message: "A cumulative result PDF already exists for this class and session"
      });
    }

    const pdfUpload = await uploadPdfBuffer(req.file.buffer, {
      fileName,
      contentType: req.file.mimetype,
      metadata: {
        type: "cumulative-result",
        teacher: assigned_teacher,
        class_record,
        session,
        class: studentClass
      }
    });

    let result;

    try {
      result = await CumulativeResult.create({
        assigned_teacher,
        class_record,
        session,
        class: studentClass,
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

const uploadBulkCumulativeResults = async (req, res) => {
  try {
    const { session } = req.body;
    const files = req.files || [];
    const entries = JSON.parse(req.body.entries || "[]");

    if (!session) {
      return res.status(400).json({
        message: "Session is required"
      });
    }

    if (!files.length || !entries.length) {
      return res.status(400).json({
        message: "At least one PDF file is required"
      });
    }

    if (files.length !== entries.length) {
      return res.status(400).json({
        message: "Every bulk cumulative result entry must have one PDF file"
      });
    }

    const results = [];
    const seenClasses = new Set();

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index] || {};
      const file = files[index];
      const label = entry.className || file?.originalname || `File ${index + 1}`;
      let pdfUpload = null;

      try {
        if (!entry.class_record || !entry.assigned_teacher || !entry.class) {
          throw new Error("Class and form teacher are required");
        }

        const duplicateKey = `${entry.class_record}-${entry.assigned_teacher}-${session}`;

        if (seenClasses.has(duplicateKey)) {
          throw new Error("This class appears more than once in the bulk upload");
        }

        seenClasses.add(duplicateKey);

        if (!file || !isPdfBuffer(file.buffer)) {
          throw new Error("Invalid PDF file");
        }

        const [selectedClass, teacher] = await Promise.all([
          Class.findById(entry.class_record),
          Teacher.findById(entry.assigned_teacher)
        ]);

        if (!selectedClass || selectedClass.session !== session) {
          throw new Error("Selected class must belong to the selected session");
        }

        if (!teacher) {
          throw new Error("Teacher not found");
        }

        const teacherAssignment = getTeacherAssignmentForSessionClass(
          teacher,
          {
            session,
            classRecordId: entry.class_record
          }
        );

        if (
          teacher.status === "inactive" ||
          !teacherAssignment
        ) {
          throw new Error(
            "Selected teacher is not the active form teacher for this class and session"
          );
        }

        const fileName = createSafeFileName(
          teacherAssignment.assigned_class || entry.class,
          session
        );

        const existingResult = await CumulativeResult.findOne({
          session,
          class_record: selectedClass._id,
          assigned_teacher: teacher._id
        });

        if (existingResult) {
          throw new Error(
            "A cumulative result PDF already exists for this class and session"
          );
        }

        pdfUpload = await uploadPdfBuffer(file.buffer, {
          fileName,
          contentType: file.mimetype,
          metadata: {
            type: "cumulative-result",
            teacher: entry.assigned_teacher,
            class_record: entry.class_record,
            session,
            class: selectedClass.name
          }
        });

        const result = await CumulativeResult.create({
          assigned_teacher: entry.assigned_teacher,
          class_record: entry.class_record,
          session,
          class: selectedClass.name,
          ...getPdfStorageFields(pdfUpload, {
            contentType: file.mimetype,
            fileName
          })
        });

        results.push({
          ok: true,
          label,
          result: {
            ...result.toObject(),
            pdf_data: undefined
          }
        });
      } catch (error) {
        await deletePdfFile(pdfUpload);
        results.push({
          ok: false,
          label,
          message: error.message
        });
      }
    }

    const uploadedCount = results.filter((result) => result.ok).length;

    res.status(uploadedCount === entries.length ? 201 : 207).json({
      uploadedCount,
      failedCount: entries.length - uploadedCount,
      results
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        message: "Bulk cumulative result entries must be valid JSON"
      });
    }

    return res.status(500).json({
      error: error.message
    });
  }
};

const getAllCumulativeResults = async (req, res) => {
  try {
    const query = buildCumulativeResultQuery()
      .populate("student", "full_name admission_no class current_session")
      .populate("assigned_teacher", "full_name username assigned_class")
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

const getApprovedTeacherCumulativeResults = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    if (teacher.status === "inactive") {
      return res.json([]);
    }

    const access = await ResultAccess.findOne({
      key: "active-result-access"
    });

    if (!access?.cumulative_session) {
      return res.json([]);
    }

    const teacherAssignment = getTeacherAssignmentForSession(teacher, {
      session: access.cumulative_session
    });

    if (!teacherAssignment) {
      return res.json([]);
    }

    const results = await CumulativeResult.find({
      session: access.cumulative_session,
      $or: [
        {
          class_record: teacherAssignment.assigned_class_record,
          assigned_teacher: teacher._id
        },
        {
          class: new RegExp(`^${escapeRegex(teacherAssignment.assigned_class)}$`, "i")
        }
      ],
      $and: [
        {
          $or: [
            { pdf_file_id: { $exists: true } },
            { pdf_data: { $exists: true } }
          ]
        }
      ]
    })
      .populate("assigned_teacher", "full_name username assigned_class")
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
          type: "cumulative-result",
          student: targetStudentId.toString(),
          session: nextSession,
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

const deleteCumulativeResult = async (req, res) => {
  try {
    const result = await CumulativeResult.findById(req.params.resultId);

    if (!result) {
      return res.status(404).json({
        message: "Cumulative result not found"
      });
    }

    await result.deleteOne();
    await deletePdfFile(result);

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
  uploadBulkCumulativeResults,
  getAllCumulativeResults,
  getStudentCumulativeResults,
  getApprovedTeacherCumulativeResults,
  updateCumulativeResult,
  deleteCumulativeResult,
  viewCumulativeResult,
  downloadCumulativeResult
};
