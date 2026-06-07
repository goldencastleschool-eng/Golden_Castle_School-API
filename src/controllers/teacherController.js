const bcrypt = require("bcryptjs");

const Teacher = require("../models/teacherModel");
const Class = require("../models/classModel");

const sanitizeTeacher = (teacher) => {
  const safeTeacher = teacher.toObject ? teacher.toObject() : { ...teacher };

  delete safeTeacher.password;

  return safeTeacher;
};

const getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find()
      .select("-password")
      .populate("assigned_class_record")
      .sort({
        createdAt: -1
      });

    res.json(teachers);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createTeacher = async (req, res) => {
  try {
    const {
      full_name,
      username,
      session,
      assigned_class_record,
      password
    } = req.body;

    if (!full_name || !username || !session || !assigned_class_record || !password) {
      return res.status(400).json({
        message: "Full name, username, session, assigned class, and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const selectedClass = await Class.findById(assigned_class_record);

    if (!selectedClass || selectedClass.session !== session) {
      return res.status(400).json({
        message: "Assigned class must belong to the selected session"
      });
    }

    const existingTeacher = await Teacher.findOne({
      username: username.trim().toLowerCase()
    });

    if (existingTeacher) {
      return res.status(400).json({
        message: "Teacher username already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const teacher = await Teacher.create({
      full_name,
      username: username.trim().toLowerCase(),
      session,
      assigned_class: selectedClass.name,
      assigned_class_record: selectedClass._id,
      password: hashedPassword
    });

    res.status(201).json(sanitizeTeacher(teacher));

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getTeachers,
  createTeacher
};
