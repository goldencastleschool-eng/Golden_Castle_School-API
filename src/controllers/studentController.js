const bcrypt = require("bcryptjs");

const Student = require("../models/studentModel");

const Result = require("../models/resultModel");

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

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await Student.create({
      full_name,
      admission_no,
      class: studentClass,
      current_session,
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
    const students = await Student.find().select("-password").sort({
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

    student.full_name = full_name || student.full_name;
    student.admission_no = admission_no || student.admission_no;
    student.class = studentClass || student.class;
    student.current_session = current_session || student.current_session;
    student.gender = gender || student.gender;

    if (password) {
      student.password = await bcrypt.hash(password, 10);
    }

    const updatedStudent = await student.save();

    await Result.updateMany(
      { student: updatedStudent._id },
      { class: updatedStudent.class }
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
      toSession
    } = req.body;

    if (!fromClass || !toClass || !fromSession || !toSession) {
      return res.status(400).json({
        message: "From class, to class, from session, and to session are required"
      });
    }

    if (
      fromClass.trim().toLowerCase() === toClass.trim().toLowerCase() &&
      fromSession.trim() === toSession.trim()
    ) {
      return res.status(400).json({
        message: "Promotion target must be different from the current class or session"
      });
    }

    const promotionResult = await Student.updateMany(
      {
        class: fromClass,
        current_session: fromSession
      },
      {
        class: toClass,
        current_session: toSession
      }
    );

    res.json({
      message: `${promotionResult.modifiedCount} student(s) promoted successfully.`,
      matchedCount: promotionResult.matchedCount,
      modifiedCount: promotionResult.modifiedCount
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
