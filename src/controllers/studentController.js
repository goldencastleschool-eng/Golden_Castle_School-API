const bcrypt = require("bcryptjs");

const Student = require("../models/studentModel");

const Result = require("../models/resultModel");

const Class = require("../models/classModel");

const {
  ensureClassRecord,
  normalizeClassName,
  normalizeSession
} = require("../utils/classRecords");

const sanitizeStudent = (student) => {
  const safeStudent = student.toObject
    ? student.toObject()
    : { ...student };

  delete safeStudent.password;

  return safeStudent;
};

const activeStudentStatusQuery = {
  $or: [
    { status: "active" },
    { status: { $exists: false } },
    { status: null },
    { status: "" }
  ]
};

const isActiveStudentRecord = (student) =>
  !student.status || student.status === "active";

const studentBelongsToClassRecord = (student, classRecord) => {
  const studentClassRecordId =
    student.class_record?._id || student.class_record || "";

  return (
    studentClassRecordId.toString() === classRecord._id.toString() ||
    (
      normalizeClassName(student.class) === normalizeClassName(classRecord.name) &&
      normalizeSession(student.current_session) === normalizeSession(classRecord.session)
    )
  );
};

const registerStudent = async (req, res) => {
  try {
    const {
      full_name,
      admission_no,
      class: studentClass,
      class_record,
      current_session,
      gender,
      password
    } = req.body;

    const existingStudent = await Student.findOne({
      admission_no
    });

    if (existingStudent) {
      return res.status(400).json({
        message: "Student already exists"
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    if (!current_session) {
      return res.status(400).json({
        message: "Current session is required"
      });
    }

    const selectedClass = class_record
      ? await Class.findById(class_record)
      : await ensureClassRecord(studentClass, current_session);

    if (!selectedClass) {
      return res.status(400).json({
        message: "Class and session are required"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await Student.create({
      full_name,
      admission_no,
      class: selectedClass.name,
      class_record: selectedClass._id,
      current_session: selectedClass.session,
      gender,
      password: hashedPassword
    });

    res.status(201).json(sanitizeStudent(student));

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select("-password")
      .populate("class_record")
      .sort({
        createdAt: -1
      });

    res.json(students);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateStudent = async (req, res) => {
  try {
    const {
      full_name,
      admission_no,
      class: studentClass,
      class_record,
      current_session,
      gender,
      password
    } = req.body;

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    if (
      admission_no &&
      admission_no !== student.admission_no
    ) {
      const existingStudent = await Student.findOne({
        admission_no
      });

      if (existingStudent) {
        return res.status(400).json({
          message: "Admission number already exists"
        });
      }
    }

    const previousClass = student.class;
    const previousSession = student.current_session;

    const selectedClass = class_record
      ? await Class.findById(class_record)
      : studentClass || current_session
        ? await ensureClassRecord(
            studentClass || student.class,
            current_session || student.current_session
          )
        : null;

    if ((class_record || studentClass || current_session) && !selectedClass) {
      return res.status(400).json({
        message: "Class and session are required"
      });
    }

    student.full_name = full_name || student.full_name;
    student.admission_no = admission_no || student.admission_no;
    student.class = selectedClass?.name || student.class;
    student.class_record = selectedClass?._id || student.class_record;
    student.current_session = selectedClass?.session || student.current_session;
    student.gender = gender || student.gender;

    if (password) {
      student.password = await bcrypt.hash(password, 10);
    }

    const updatedStudent = await student.save();

    await Result.updateMany(
      {
        student: updatedStudent._id,
        class: previousClass,
        session: previousSession
      },
      {
        class: updatedStudent.class,
        session: updatedStudent.current_session
      }
    );

    res.json(sanitizeStudent(updatedStudent));

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    await Result.deleteMany({
      student: student._id
    });

    await student.deleteOne();

    res.json({
      message: "Student deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const promoteStudentsByClass = async (req, res) => {
  try {
    const {
      fromClass,
      toClass,
      fromSession,
      toSession,
      fromClassRecord,
      toClassRecord,
      studentIds = []
    } = req.body;

    if (
      (!fromClassRecord && (!fromClass || !fromSession)) ||
      (!toClassRecord && (!toClass || !toSession))
    ) {
      return res.status(400).json({
        message: "From class, to class, from session, and to session are required"
      });
    }

    const sourceClass = fromClassRecord
      ? await Class.findById(fromClassRecord)
      : await ensureClassRecord(fromClass, fromSession);

    const targetClass = toClassRecord
      ? await Class.findById(toClassRecord)
      : await ensureClassRecord(toClass, toSession);

    if (!sourceClass || !targetClass) {
      return res.status(400).json({
        message: "Source and target class records are required"
      });
    }

    if (sourceClass._id.toString() === targetClass._id.toString()) {
      return res.status(400).json({
        message: "Promotion target must be different from the current class or session"
      });
    }

    const sourceClassQuery = {
      $or: [
        { class_record: sourceClass._id },
        {
          class: normalizeClassName(sourceClass.name),
          current_session: normalizeSession(sourceClass.session)
        }
      ]
    };

    const selectedStudentIds = Array.isArray(studentIds)
      ? studentIds.filter(Boolean)
      : [];

    const promotionResult = await Student.updateMany(
      selectedStudentIds.length > 0
        ? {
            _id: { $in: selectedStudentIds },
            $and: [sourceClassQuery, activeStudentStatusQuery]
          }
        : {
            $and: [sourceClassQuery, activeStudentStatusQuery]
          },
      {
        class: targetClass.name,
        class_record: targetClass._id,
        current_session: targetClass.session,
        status: "active",
        graduated_at: null,
        graduation_session: "",
        graduation_class: "",
        left_at: null,
        left_session: "",
        left_term: "",
        left_class: ""
      }
    );

    res.json({
      message: `${promotionResult.modifiedCount} student(s) moved to ${targetClass.name.toUpperCase()} for ${targetClass.session}.`,
      matchedCount: promotionResult.matchedCount,
      modifiedCount: promotionResult.modifiedCount,
      selectedCount: selectedStudentIds.length,
      classRecord: targetClass
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const graduateStudents = async (req, res) => {
  try {
    const {
      fromClass,
      fromSession,
      fromClassRecord,
      studentIds = [],
      graduationSession
    } = req.body;

    if (!fromClassRecord && (!fromClass || !fromSession)) {
      return res.status(400).json({
        message: "Class and session are required"
      });
    }

    const sourceClass = fromClassRecord
      ? await Class.findById(fromClassRecord)
      : await ensureClassRecord(fromClass, fromSession);

    if (!sourceClass) {
      return res.status(400).json({
        message: "Source class record is required"
      });
    }

    const selectedStudentIds = Array.isArray(studentIds)
      ? studentIds.filter(Boolean)
      : [];

    if (selectedStudentIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one student to graduate"
      });
    }

    const selectedStudents = await Student.find({
      _id: { $in: selectedStudentIds }
    }).select("_id status class class_record current_session");

    const eligibleStudentIds = selectedStudents
      .filter(
        (student) =>
          isActiveStudentRecord(student) &&
          studentBelongsToClassRecord(student, sourceClass)
      )
      .map((student) => student._id);

    if (eligibleStudentIds.length === 0) {
      return res.status(400).json({
        message: "No selected active student belongs to this class/session"
      });
    }

    const graduationResult = await Student.updateMany(
      {
        _id: { $in: eligibleStudentIds }
      },
      {
        status: "graduated",
        graduated_at: new Date(),
        graduation_session: graduationSession || sourceClass.session,
        graduation_class: sourceClass.name
      }
    );

    res.json({
      message: `${graduationResult.modifiedCount} student(s) graduated successfully.`,
      matchedCount: graduationResult.matchedCount,
      modifiedCount: graduationResult.modifiedCount,
      selectedCount: selectedStudentIds.length
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const restoreGraduatedStudents = async (req, res) => {
  try {
    const {
      studentIds = []
    } = req.body;

    const selectedStudentIds = Array.isArray(studentIds)
      ? studentIds.filter(Boolean)
      : [];

    if (selectedStudentIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one graduated student to restore"
      });
    }

    const restoreResult = await Student.updateMany(
      {
        _id: { $in: selectedStudentIds },
        status: "graduated"
      },
      {
        status: "active",
        graduated_at: null,
        graduation_session: "",
        graduation_class: ""
      }
    );

    res.json({
      message: `${restoreResult.modifiedCount} student(s) restored to active students.`,
      matchedCount: restoreResult.matchedCount,
      modifiedCount: restoreResult.modifiedCount,
      selectedCount: selectedStudentIds.length
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const markStudentsLeftSchool = async (req, res) => {
  try {
    const {
      fromClass,
      fromSession,
      fromClassRecord,
      studentIds = [],
      leftSession,
      leftTerm
    } = req.body;

    if (!fromClassRecord && (!fromClass || !fromSession)) {
      return res.status(400).json({
        message: "Class and session are required"
      });
    }

    if (!leftSession || !leftTerm) {
      return res.status(400).json({
        message: "Leaving session and term are required"
      });
    }

    const sourceClass = fromClassRecord
      ? await Class.findById(fromClassRecord)
      : await ensureClassRecord(fromClass, fromSession);

    if (!sourceClass) {
      return res.status(400).json({
        message: "Source class record is required"
      });
    }

    const selectedStudentIds = Array.isArray(studentIds)
      ? studentIds.filter(Boolean)
      : [];

    if (selectedStudentIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one student that left the school"
      });
    }

    const selectedStudents = await Student.find({
      _id: { $in: selectedStudentIds }
    }).select("_id status class class_record current_session");

    const eligibleStudentIds = selectedStudents
      .filter(
        (student) =>
          isActiveStudentRecord(student) &&
          studentBelongsToClassRecord(student, sourceClass)
      )
      .map((student) => student._id);

    if (eligibleStudentIds.length === 0) {
      return res.status(400).json({
        message: "No selected active student belongs to this class/session"
      });
    }

    const leftResult = await Student.updateMany(
      {
        _id: { $in: eligibleStudentIds }
      },
      {
        status: "left",
        left_at: new Date(),
        left_session: leftSession,
        left_term: leftTerm,
        left_class: sourceClass.name
      }
    );

    res.json({
      message: `${leftResult.modifiedCount} student(s) marked as left school.`,
      matchedCount: leftResult.matchedCount,
      modifiedCount: leftResult.modifiedCount,
      selectedCount: selectedStudentIds.length
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  registerStudent,
  getAllStudents,
  updateStudent,
  deleteStudent,
  promoteStudentsByClass,
  graduateStudents,
  restoreGraduatedStudents,
  markStudentsLeftSchool
};
