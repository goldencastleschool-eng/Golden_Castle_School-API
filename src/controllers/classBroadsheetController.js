const ClassBroadsheet = require("../models/classBroadsheetModel");
const Class = require("../models/classModel");
const ResultAccess = require("../models/resultAccessModel");
const Teacher = require("../models/teacherModel");
const { isFormTeacher } = require("../utils/teacherAssignments");
const {
  deletePdfFile,
  sendPdfFile,
  uploadPdfBuffer
} = require("../utils/pdfStorage");

const createSafeFileName = (...parts) => {
  return `${parts.filter(Boolean).join("-")}-broadsheet.pdf`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const isPdfBuffer = (buffer) => {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString() === "%PDF";
};

const broadsheetListQuery = () =>
  ClassBroadsheet.find({
    $or: [
      { pdf_file_id: { $exists: true } },
      { pdf_data: { $exists: true } }
    ]
  }).select("-pdf_data");

const getClassBroadsheets = async (req, res) => {
  try {
    const broadsheets = await broadsheetListQuery()
      .populate("class_record")
      .populate("assigned_teacher", "full_name username")
      .sort({ createdAt: -1 });

    res.json(broadsheets);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadClassBroadsheet = async (req, res) => {
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

    const existingBroadsheet = await ClassBroadsheet.findOne(
      {
        session,
        term,
        class_record: selectedClass._id,
        assigned_teacher: selectedTeacher._id
      }
    );

    const pdfFileId = await uploadPdfBuffer(req.file.buffer, {
      fileName,
      contentType: req.file.mimetype,
      metadata: {
        type: "class-broadsheet",
        session,
        term,
        class: selectedClass.name,
        class_record: selectedClass._id.toString(),
        assigned_teacher: selectedTeacher._id.toString()
      }
    });

    let broadsheet;

    try {
      broadsheet = await ClassBroadsheet.findOneAndUpdate(
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

    await deletePdfFile(existingBroadsheet?.pdf_file_id);

    res.status(201).json(broadsheet);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteClassBroadsheet = async (req, res) => {
  try {
    const broadsheet = await ClassBroadsheet.findById(req.params.broadsheetId);

    if (!broadsheet) {
      return res.status(404).json({ message: "Class broadsheet not found" });
    }

    const pdfFileId = broadsheet.pdf_file_id;

    await broadsheet.deleteOne();
    await deletePdfFile(pdfFileId);

    res.json({ message: "Class broadsheet deleted successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getApprovedTeacherBroadsheets = async (req, res) => {
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

    if (!access?.broadsheet_session || !access?.broadsheet_term) {
      return res.json([]);
    }

    const broadsheets = await ClassBroadsheet.find({
      session: access.broadsheet_session,
      term: access.broadsheet_term,
      class_record: teacher.assigned_class_record,
      assigned_teacher: teacher._id,
      $or: [
        { pdf_file_id: { $exists: true } },
        { pdf_data: { $exists: true } }
      ]
    })
      .select("-pdf_data")
      .sort({ createdAt: -1 });

    res.json(broadsheets);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const enforceTeacherBroadsheetAccess = async (req, broadsheet) => {
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
    broadsheet.assigned_teacher?.toString() === teacher._id.toString() &&
    teacher.assigned_class_record?.toString() ===
    broadsheet.class_record.toString();

  if (
    !belongsToTeacher ||
    !access?.broadsheet_session ||
    !access?.broadsheet_term ||
    broadsheet.session !== access.broadsheet_session ||
    broadsheet.term !== access.broadsheet_term
  ) {
    return {
      allowed: false,
      status: 403,
      message: "This class broadsheet is not currently available"
    };
  }

  return { allowed: true };
};

const sendClassBroadsheetPdf = async (req, res, dispositionType) => {
  try {
    const broadsheet = await ClassBroadsheet.findById(req.params.broadsheetId);

    if (!broadsheet) {
      return res.status(404).json({ message: "Class broadsheet not found" });
    }

    const access = await enforceTeacherBroadsheetAccess(req, broadsheet);

    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    return sendPdfFile({
      res,
      fileId: broadsheet.pdf_file_id,
      fallbackBuffer: broadsheet.pdf_data,
      fileName: broadsheet.file_name,
      contentType: broadsheet.pdf_mime_type,
      dispositionType,
      unavailableMessage: "Class broadsheet PDF file is not available."
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const viewClassBroadsheet = (req, res) =>
  sendClassBroadsheetPdf(req, res, "inline");

const downloadClassBroadsheet = (req, res) =>
  sendClassBroadsheetPdf(req, res, "attachment");

module.exports = {
  getClassBroadsheets,
  uploadClassBroadsheet,
  deleteClassBroadsheet,
  getApprovedTeacherBroadsheets,
  viewClassBroadsheet,
  downloadClassBroadsheet
};
