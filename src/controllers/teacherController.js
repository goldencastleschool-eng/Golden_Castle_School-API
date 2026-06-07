const bcrypt = require("bcryptjs");

const Teacher = require("../models/teacherModel");
const Class = require("../models/classModel");

const sanitizeTeacher = (teacher) => {
  const safeTeacher = teacher.toObject ? teacher.toObject() : { ...teacher };

  delete safeTeacher.password;

  return safeTeacher;
};

const normalizeUsernamePart = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const buildTeacherUsername = async (fullName) => {
  const namePart = normalizeUsernamePart(fullName);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const username = `${namePart}${suffix}`;
    const existingTeacher = await Teacher.findOne({ username });

    if (!existingTeacher) {
      return username;
    }
  }

  throw new Error("Unable to generate a unique teacher username");
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
      session,
      assigned_class_record,
      password
    } = req.body;

    if (!full_name || !session || !assigned_class_record || !password) {
      return res.status(400).json({
        message: "Full name, session, assigned class, and password are required"
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = await buildTeacherUsername(full_name);

    const teacher = await Teacher.create({
      full_name,
      username,
      session,
      assigned_class: selectedClass.name,
      assigned_class_record: selectedClass._id,
      password: hashedPassword,
      initial_password: hashedPassword
    });

    res.status(201).json(sanitizeTeacher(teacher));

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateTeacher = async (req, res) => {
  try {
    const {
      full_name,
      session,
      assigned_class_record,
      password
    } = req.body;

    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    const selectedClass = assigned_class_record
      ? await Class.findById(assigned_class_record)
      : null;

    if ((assigned_class_record || session) && !selectedClass) {
      return res.status(400).json({
        message: "Assigned class is required"
      });
    }

    if (selectedClass && selectedClass.session !== session) {
      return res.status(400).json({
        message: "Assigned class must belong to the selected session"
      });
    }

    const shouldRegenerateUsername =
      (full_name && full_name !== teacher.full_name) ||
      (selectedClass && selectedClass.name !== teacher.assigned_class);

    teacher.full_name = full_name || teacher.full_name;
    teacher.session = selectedClass?.session || session || teacher.session;
    teacher.assigned_class = selectedClass?.name || teacher.assigned_class;
    teacher.assigned_class_record =
      selectedClass?._id || teacher.assigned_class_record;

    if (shouldRegenerateUsername) {
      teacher.username = await buildTeacherUsername(teacher.full_name);
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters"
        });
      }

      teacher.password = await bcrypt.hash(password, 10);
    }

    const updatedTeacher = await teacher.save();

    res.json(sanitizeTeacher(updatedTeacher));

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const resetTeacherPassword = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    if (!teacher.initial_password) {
      return res.status(400).json({
        message:
          "Original registration password is not available for this teacher. Set a new password by editing the teacher record."
      });
    }

    teacher.password = teacher.initial_password;
    await teacher.save();

    res.json({
      message: "Teacher password reset to original registration password"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    await teacher.deleteOne();

    res.json({
      message: "Teacher deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getTeachers,
  createTeacher,
  updateTeacher,
  resetTeacherPassword,
  deleteTeacher
};
