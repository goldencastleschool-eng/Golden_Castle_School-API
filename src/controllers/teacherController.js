const bcrypt = require("bcryptjs");

const Teacher = require("../models/teacherModel");
const Class = require("../models/classModel");
const {
  TEACHER_ASSIGNMENT_TYPES,
  canUseAssignmentTypeForClass,
  getTeacherAssignmentType,
  normalizeTeacherAssignmentType
} = require("../utils/teacherAssignments");

const sanitizeTeacher = (teacher) => {
  const safeTeacher = teacher.toObject ? teacher.toObject() : { ...teacher };

  delete safeTeacher.password;
  safeTeacher.assignment_type = getTeacherAssignmentType(safeTeacher);

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

const resolveRequestedAssignmentType = (
  assignmentType,
  fallbackAssignmentType = TEACHER_ASSIGNMENT_TYPES.FORM
) => {
  if (
    assignmentType === undefined ||
    assignmentType === null ||
    assignmentType === ""
  ) {
    return {
      assignmentType: fallbackAssignmentType
    };
  }

  const normalizedAssignmentType =
    normalizeTeacherAssignmentType(assignmentType);

  if (!normalizedAssignmentType) {
    return {
      error: "Teacher assignment type is invalid"
    };
  }

  return {
    assignmentType: normalizedAssignmentType
  };
};

const validateAssignmentTypeForClass = (assignmentType, selectedClass) => {
  if (canUseAssignmentTypeForClass(assignmentType, selectedClass)) {
    return "";
  }

  return "Class teacher assignment is only available for secondary classes. Basic, nursery, and pre nursery classes must use form teacher.";
};

const addAssignmentHistory = (teacher, reason = "Assignment changed") => {
  if (!teacher.assigned_class_record) {
    return;
  }

  teacher.assignment_history.push({
    assigned_class: teacher.assigned_class,
    assigned_class_record: teacher.assigned_class_record,
    assignment_type: getTeacherAssignmentType(teacher),
    session: teacher.session,
    status: teacher.status,
    ended_at: new Date(),
    reason
  });
};

const getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find()
      .select("-password")
      .populate("assigned_class_record")
      .sort({
        createdAt: -1
      });

    res.json(teachers.map(sanitizeTeacher));

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
      assignment_type,
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

    const requestedAssignment = resolveRequestedAssignmentType(
      assignment_type
    );

    if (requestedAssignment.error) {
      return res.status(400).json({
        message: requestedAssignment.error
      });
    }

    const assignmentValidationMessage = validateAssignmentTypeForClass(
      requestedAssignment.assignmentType,
      selectedClass
    );

    if (assignmentValidationMessage) {
      return res.status(400).json({
        message: assignmentValidationMessage
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
      assignment_type: requestedAssignment.assignmentType,
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
      assignment_type,
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
      : teacher.assigned_class_record
        ? await Class.findById(teacher.assigned_class_record)
        : null;

    if ((assigned_class_record || session) && !selectedClass) {
      return res.status(400).json({
        message: "Assigned class is required"
      });
    }

    if (selectedClass && session && selectedClass.session !== session) {
      return res.status(400).json({
        message: "Assigned class must belong to the selected session"
      });
    }

    const previousAssignmentType = getTeacherAssignmentType(teacher);
    const requestedAssignment = resolveRequestedAssignmentType(
      assignment_type,
      previousAssignmentType
    );

    if (requestedAssignment.error) {
      return res.status(400).json({
        message: requestedAssignment.error
      });
    }

    const assignmentValidationMessage = selectedClass
      ? validateAssignmentTypeForClass(
          requestedAssignment.assignmentType,
          selectedClass
        )
      : "";

    if (assignmentValidationMessage) {
      return res.status(400).json({
        message: assignmentValidationMessage
      });
    }

    const shouldRegenerateUsername =
      (full_name && full_name !== teacher.full_name) ||
      (selectedClass && selectedClass.name !== teacher.assigned_class);

    const isReassigningClass =
      assigned_class_record &&
      selectedClass &&
      teacher.assigned_class_record?.toString() !== selectedClass._id.toString();
    const isChangingAssignmentType =
      requestedAssignment.assignmentType !== previousAssignmentType;

    if (isReassigningClass || isChangingAssignmentType) {
      addAssignmentHistory(teacher, "Assignment updated by admin");
    }

    teacher.full_name = full_name || teacher.full_name;
    teacher.session = selectedClass?.session || session || teacher.session;
    teacher.assigned_class = selectedClass?.name || teacher.assigned_class;
    teacher.assigned_class_record =
      selectedClass?._id || teacher.assigned_class_record;
    teacher.assignment_type = requestedAssignment.assignmentType;
    teacher.status = "active";
    teacher.deactivated_at = null;
    teacher.deactivation_reason = "";

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

const deactivateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found"
      });
    }

    if (teacher.status === "inactive") {
      return res.status(400).json({
        message: "Teacher is already inactive"
      });
    }

    const reason =
      req.body?.reason?.trim() ||
      "Teacher deactivated by admin";

    addAssignmentHistory(teacher, reason);

    teacher.status = "inactive";
    teacher.deactivated_at = new Date();
    teacher.deactivation_reason = reason;
    teacher.assigned_class = "";
    teacher.assigned_class_record = null;

    const updatedTeacher = await teacher.save();

    res.json({
      message:
        "Teacher deactivated successfully. Previous records remain linked to this teacher.",
      teacher: sanitizeTeacher(updatedTeacher)
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
  deactivateTeacher,
  resetTeacherPassword,
  deleteTeacher
};
