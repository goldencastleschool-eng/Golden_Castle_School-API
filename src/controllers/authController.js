const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const Admin = require("../models/adminModel");

const Student = require("../models/studentModel");

const generateToken = require("../utils/generateToken");

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const setAuthCookie = (res, token) => {
  res.cookie("auth_token", token, cookieOptions);
};

const clearAuthCookie = (res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
};

// ADMIN LOGIN
const adminLogin = async (req, res) => {
  try {

    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = generateToken(
      admin._id,
      admin.role
    );

    setAuthCookie(res, token);

    res.json({
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role
      }
      
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


// STUDENT LOGIN
const studentLogin = async (req, res) => {
  try {

    const { admission_no, password } = req.body;

    const student = await Student.findOne({
      admission_no
    });

    if (!student) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      student.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = generateToken(
      student._id,
      "student"
    );

    setAuthCookie(res, token);

    res.json({
      student: {
        id: student._id,
        full_name: student.full_name,
        admission_no: student.admission_no,
        class: student.class
      }
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const logout = (req, res) => {
  clearAuthCookie(res);

  res.json({
    message: "Logged out successfully"
  });
};

module.exports = {
  adminLogin,
  studentLogin,
  logout
};
