const ClassResult = require("../models/classResultModel");
const Class = require("../models/classModel");
const ResultAccess = require("../models/resultAccessModel");
const Teacher = require("../models/teacherModel");
const {
  deletePdfFile,
  sendPdfFile,
  uploadPdfBuffer
} = require("../utils/pdfStorage");

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

const classResultListQuery = () =>
  ClassResult.find({
    $or: [
      { pdf_file_id: { $exists: true } },
      { pdf_data: { $exists: true } }
    ]
  }).select("-pdf_data");

const getClassResults = async (req, res) => {
  try {
    const classResults = await classResultListQuery()
      .populate("class_record")
      .populate("assigned_teacher", "full_name username")
      .sort({ createdAt: -1 });

    res.json(classResults);
  } catch (error) {
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

    const pdfFileId = await uploadPdfBuffer(req.file.buffer, {
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
      classResult = await ClassResult.findOneAndUpdate(
        {
          session,
          term,
          class_record: selectedClass._id,
          assigned_teacher: selectedTeacher._id
        },
        {
          $set: {
            session,
            term,
            class: selectedClass.name,
            class_record: selectedClass._id,
            assigned_teacher: selectedTeacher._id,
            pdf_file_id: pdfFileId,
            pdf_mime_type: req.file.mimetype,
            file_name: fileName
          },
          $unset: {
            pdf_data: ""
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      ).select("-pdf_data");
    } catch (error) {
      await deletePdfFile(pdfFileId);
      throw error;
    }

    await deletePdfFile(existingClassResult?.pdf_file_id);

    res.status(201).json(classResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteClassResult = async (req, res) => {
  try {
    const classResult = await ClassResult.findById(req.params.classResultId);

    if (!classResult) {
      return res.status(404).json({ message: "Class result not found" });
    }

    const pdfFileId = classResult.pdf_file_id;

    await classResult.deleteOne();
    await deletePdfFile(pdfFileId);

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
      $or: [
        { pdf_file_id: { $exists: true } },
        { pdf_data: { $exists: true } }
      ]
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

    return sendPdfFile({
      res,
      fileId: classResult.pdf_file_id,
      fallbackBuffer: classResult.pdf_data,
      fileName: classResult.file_name,
      contentType: classResult.pdf_mime_type,
      dispositionType,
      unavailableMessage: "Class result PDF file is not available."
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
  deleteClassResult,
  getApprovedTeacherClassResults,
  viewClassResult,
  downloadClassResult
};
