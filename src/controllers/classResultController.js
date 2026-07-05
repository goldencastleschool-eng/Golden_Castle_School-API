const ClassResult = require("../models/classResultModel");
const Class = require("../models/classModel");
const ResultAccess = require("../models/resultAccessModel");
const Teacher = require("../models/teacherModel");
const { isFormTeacher } = require("../utils/teacherAssignments");
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
  return `${parts.filter(Boolean).join("-")}-class-result.pdf`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const isPdfBuffer = (buffer) => {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString() === "%PDF";
};

const isDuplicateKeyError = (error) => error?.code === 11000;

const pdfRecordQuery = {
  $or: [
    { pdf_file_id: { $exists: true, $nin: [null, ""] } },
    { pdf_file_key: { $exists: true, $nin: [null, ""] } },
    { pdf_data: { $exists: true, $nin: [null, ""] } }
  ]
};

const classResultListQuery = () =>
  ClassResult.find(pdfRecordQuery).select("-pdf_data");

const getClassResults = async (req, res) => {
  try {
    const query = classResultListQuery()
      .populate("class_record")
      .populate("assigned_teacher", "full_name username")
      .sort({ createdAt: -1 });
    const classResults = await applyListQueryOptions(
      query,
      getListQueryOptions(req.query)
    );

    res.json(classResults);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        message: "A class result PDF already exists for this class, session, and term"
      });
    }

    res.status(500).json({ error: error.message });
  }
};

const uploadClassResult = async (req, res) => {
  try {
    const {
      session,
      term,
      class_record,
      assigned_teacher
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "PDF file required" });
    }

    if (!isPdfBuffer(req.file.buffer)) {
      return res.status(400).json({ message: "Invalid PDF file" });
    }

    if (!session || !term || !class_record || !assigned_teacher) {
      return res.status(400).json({
        message: "Session, term, class, and form teacher are required"
      });
    }

    const selectedClass = await Class.findById(class_record);

    if (!selectedClass || selectedClass.session !== session) {
      return res.status(400).json({
        message: "Selected class must belong to the selected session"
      });
    }

    const selectedTeacher = await Teacher.findById(assigned_teacher);
    const teacherClassId = selectedTeacher?.assigned_class_record?.toString();

    if (
      !selectedTeacher ||
      selectedTeacher.status === "inactive" ||
      !isFormTeacher(selectedTeacher) ||
      selectedTeacher.session !== session ||
      !teacherClassId ||
      teacherClassId !== selectedClass._id.toString()
    ) {
      return res.status(400).json({
        message: "Selected form teacher must be assigned to this class/session"
      });
    }

    const fileName = createSafeFileName(
      selectedTeacher.full_name,
      selectedClass.name,
      term,
      session
    );

    const existingClassResult = await ClassResult.findOne({
      session,
      term,
      class_record: selectedClass._id,
      assigned_teacher: selectedTeacher._id
    });

    if (existingClassResult) {
      return res.status(409).json({
        message: "A class result PDF already exists for this class, session, and term"
      });
    }

    const pdfUpload = await uploadPdfBuffer(req.file.buffer, {
      fileName,
      contentType: req.file.mimetype,
      metadata: {
        type: "class-result",
        session,
        term,
        class: selectedClass.name,
        class_record: selectedClass._id.toString(),
        assigned_teacher: selectedTeacher._id.toString()
      }
    });

    let classResult;

    try {
      classResult = await ClassResult.create({
        session,
        term,
        class: selectedClass.name,
        class_record: selectedClass._id,
        assigned_teacher: selectedTeacher._id,
        ...getPdfStorageFields(pdfUpload, {
          contentType: req.file.mimetype,
          fileName
        })
      });
    } catch (error) {
      await deletePdfFile(pdfUpload);
      throw error;
    }

    res.status(201).json(classResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadBulkClassResults = async (req, res) => {
  try {
    const { session, term } = req.body;
    const files = req.files || [];
    const entries = JSON.parse(req.body.entries || "[]");

    if (!session || !term) {
      return res.status(400).json({
        message: "Session and term are required"
      });
    }

    if (!files.length || !entries.length) {
      return res.status(400).json({
        message: "At least one PDF file is required"
      });
    }

    if (files.length !== entries.length) {
      return res.status(400).json({
        message: "Every bulk class result entry must have one PDF file"
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
        if (!entry.class_record || !entry.assigned_teacher) {
          throw new Error("Class and form teacher are required");
        }

        const duplicateKey = `${entry.class_record}-${entry.assigned_teacher}-${session}-${term}`;

        if (seenClasses.has(duplicateKey)) {
          throw new Error("This class appears more than once in the bulk upload");
        }

        seenClasses.add(duplicateKey);

        if (!file || !isPdfBuffer(file.buffer)) {
          throw new Error("Invalid PDF file");
        }

        const selectedClass = await Class.findById(entry.class_record);

        if (!selectedClass || selectedClass.session !== session) {
          throw new Error("Selected class must belong to the selected session");
        }

        const selectedTeacher = await Teacher.findById(entry.assigned_teacher);
        const teacherClassId = selectedTeacher?.assigned_class_record?.toString();

        if (
          !selectedTeacher ||
          selectedTeacher.status === "inactive" ||
          !isFormTeacher(selectedTeacher) ||
          selectedTeacher.session !== session ||
          !teacherClassId ||
          teacherClassId !== selectedClass._id.toString()
        ) {
          throw new Error("Selected form teacher must be assigned to this class/session");
        }

        const fileName = createSafeFileName(
          selectedTeacher.full_name,
          selectedClass.name,
          term,
          session
        );
        const existingClassResult = await ClassResult.findOne({
          session,
          term,
          class_record: selectedClass._id,
          assigned_teacher: selectedTeacher._id
        });

        if (existingClassResult) {
          throw new Error(
            "A class result PDF already exists for this class, session, and term"
          );
        }

        pdfUpload = await uploadPdfBuffer(file.buffer, {
          fileName,
          contentType: file.mimetype,
          metadata: {
            type: "class-result",
            session,
            term,
            class: selectedClass.name,
            class_record: selectedClass._id.toString(),
            assigned_teacher: selectedTeacher._id.toString()
          }
        });

        const classResult = await ClassResult.create({
          session,
          term,
          class: selectedClass.name,
          class_record: selectedClass._id,
          assigned_teacher: selectedTeacher._id,
          ...getPdfStorageFields(pdfUpload, {
            contentType: file.mimetype,
            fileName
          })
        });

        results.push({
          ok: true,
          label,
          result: classResult
        });
      } catch (error) {
        await deletePdfFile(pdfUpload);
        results.push({
          ok: false,
          label,
          message: isDuplicateKeyError(error)
            ? "A class result PDF already exists for this class, session, and term"
            : error.message
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
        message: "Bulk class result entries must be valid JSON"
      });
    }

    return res.status(500).json({
      error: error.message
    });
  }
};

const deleteClassResult = async (req, res) => {
  try {
    const classResult = await ClassResult.findById(req.params.classResultId);

    if (!classResult) {
      return res.status(404).json({ message: "Class result not found" });
    }

    await classResult.deleteOne();
    await deletePdfFile(classResult);

    res.json({ message: "Class result deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getApprovedTeacherClassResults = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    if (teacher.status === "inactive") {
      return res.json([]);
    }

    const access = await ResultAccess.findOne({
      key: "active-result-access"
    });

    if (!access?.class_result_session || !access?.class_result_term) {
      return res.json([]);
    }

    const classResults = await ClassResult.find({
      session: access.class_result_session,
      term: access.class_result_term,
      class_record: teacher.assigned_class_record,
      assigned_teacher: teacher._id,
      ...pdfRecordQuery
    })
      .select("-pdf_data")
      .sort({ createdAt: -1 });

    res.json(classResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const enforceTeacherClassResultAccess = async (req, classResult) => {
  if (req.user.role !== "teacher") {
    return { allowed: true };
  }

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

  const belongsToTeacher =
    classResult.assigned_teacher?.toString() === teacher._id.toString() &&
    teacher.assigned_class_record?.toString() ===
    classResult.class_record.toString();

  if (
    !belongsToTeacher ||
    !access?.class_result_session ||
    !access?.class_result_term ||
    classResult.session !== access.class_result_session ||
    classResult.term !== access.class_result_term
  ) {
    return {
      allowed: false,
      status: 403,
      message: "This class result is not currently available"
    };
  }

  return { allowed: true };
};

const sendClassResultPdf = async (req, res, dispositionType) => {
  try {
    const classResult = await ClassResult.findById(req.params.classResultId);

    if (!classResult) {
      return res.status(404).json({ message: "Class result not found" });
    }

    const access = await enforceTeacherClassResultAccess(req, classResult);

    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    const fileName = classResult.file_name || createSafeFileName(
      classResult.class,
      classResult.term,
      classResult.session
    );

    return sendPdfFile({
      res,
      storage: classResult.pdf_storage,
      fileId: classResult.pdf_file_id,
      fileKey: classResult.pdf_file_key,
      legacyFileId: classResult.legacy_pdf_file_id,
      bucket: classResult.pdf_bucket,
      fallbackBuffer: classResult.pdf_data,
      fileName,
      contentType: classResult.pdf_mime_type,
      dispositionType,
      unavailableMessage: "Class result PDF file is not available. Please re-upload this class result."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const viewClassResult = (req, res) =>
  sendClassResultPdf(req, res, "inline");

const downloadClassResult = (req, res) =>
  sendClassResultPdf(req, res, "attachment");

module.exports = {
  getClassResults,
  uploadClassResult,
  uploadBulkClassResults,
  deleteClassResult,
  getApprovedTeacherClassResults,
  viewClassResult,
  downloadClassResult
};
