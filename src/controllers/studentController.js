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

    const previousClass = student.class;
    const previousSession = student.current_session;

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
      toClassRecord
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

    const promotionResult = await Student.updateMany(
      {
        $or: [
          { class_record: sourceClass._id },
          {
            class: normalizeClassName(sourceClass.name),
            current_session: normalizeSession(sourceClass.session)
          }
        ]
      },
      {
        class: targetClass.name,
        class_record: targetClass._id,
        current_session: targetClass.session
      }
    );

    res.json({
      message: `${promotionResult.modifiedCount} student(s) moved to ${targetClass.name.toUpperCase()} for ${targetClass.session}.`,
      matchedCount: promotionResult.matchedCount,
      modifiedCount: promotionResult.modifiedCount,
      classRecord: targetClass
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
  promoteStudentsByClass
};
