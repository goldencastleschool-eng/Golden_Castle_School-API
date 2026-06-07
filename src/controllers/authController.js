const bcrypt = require("bcryptjs");
const Admin = require("../models/adminModel");
const Student = require("../models/studentModel");
const generateToken = require("../utils/generateToken");

// ======================
// ADMIN LOGIN
// ======================
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = generateToken(
      admin._id,
      admin.role
    );

    return res.status(200).json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// ======================
// STUDENT LOGIN
// ======================
const studentLogin = async (req, res) => {
  try {
    const { admission_no, password } = req.body;

    const student = await Student.findOne({
      admission_no,
    });

    if (!student) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      student.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = generateToken(
      student._id,
      "student"
    );

    return res.status(200).json({
      token,
      student: {
        id: student._id,
        full_name: student.full_name,
        admission_no: student.admission_no,
        class: student.class,
        current_session: student.current_session,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// ======================
// LOGOUT
// ======================
const logout = (req, res) => {
  return res.status(200).json({
    message: "Logged out successfully",
  });
};

const changeStudentPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }

    const student = await Student.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, student.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  adminLogin,
  studentLogin,
  changeStudentPassword,
  logout,
};
