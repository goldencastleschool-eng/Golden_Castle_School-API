const bcrypt = require("bcryptjs");
const Admin = require("../models/adminModel");
const ExecutiveAccount = require("../models/executiveAccountModel");
const Student = require("../models/studentModel");
const Teacher = require("../models/teacherModel");
const generateToken = require("../utils/generateToken");
const { getTeacherAssignmentType } = require("../utils/teacherAssignments");

const escapeRegex = (value = "") =>
  value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const invalidLoginMessage =
  "We could not sign you in. Please check your login details and try again.";

const missingLoginMessage = (identifierLabel = "username") =>
  `Enter your ${identifierLabel} and password to continue.`;

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "gcs_auth_token";
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const isLocalOrigin = (origin = "") =>
  origin.includes("localhost") || origin.includes("127.0.0.1");

const getAuthCookieOptions = (req) => {
  const origin = req?.headers?.origin || "";
  const isProduction = process.env.NODE_ENV === "production";
  const isHttpsRequest =
    req?.secure || req?.headers?.["x-forwarded-proto"] === "https";
  const isCrossSiteHttps = origin.startsWith("https://") && !isLocalOrigin(origin);
  const useSecureCrossSiteCookie =
    isProduction || isHttpsRequest || isCrossSiteHttps;

  return {
    httpOnly: true,
    secure: useSecureCrossSiteCookie,
    sameSite: useSecureCrossSiteCookie ? "none" : "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  };
};

const setAuthCookie = (req, res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(req));
};

const clearAuthCookie = (req, res) => {
  const { maxAge, ...cookieOptions } = getAuthCookieOptions(req);

  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
};

const formatAdminAccount = (admin) => ({
  id: admin._id,
  username: admin.username,
  role: admin.role,
});

const formatExecutiveAccount = (executive) => ({
  id: executive._id,
  username: executive.username,
  role: executive.role,
});

const formatStudentAccount = (student) => ({
  id: student._id,
  full_name: student.full_name,
  admission_no: student.admission_no,
  class: student.class,
  current_session: student.current_session,
  role: "student",
});

const formatTeacherAccount = (teacher) => ({
  id: teacher._id,
  full_name: teacher.full_name,
  username: teacher.username,
  session: teacher.session,
  assigned_class: teacher.assigned_class,
  assigned_class_record: teacher.assigned_class_record,
  assignment_type: getTeacherAssignmentType(teacher),
  status: teacher.status,
  role: "teacher",
});

// ======================
// ADMIN LOGIN
// ======================
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username?.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      return res.status(400).json({
        message: missingLoginMessage("username"),
      });
    }

    const admin = await Admin.findOne({ username: normalizedUsername });

    if (!admin) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    if (admin.role !== "admin") {
      return res.status(403).json({
        message: "Use the executive reports login for this account",
      });
    }

    const token = generateToken(
      admin._id,
      admin.role
    );
    setAuthCookie(req, res, token);

    return res.status(200).json({
      token,
      admin: formatAdminAccount(admin),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const executiveLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username?.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      return res.status(400).json({
        message: missingLoginMessage("username"),
      });
    }

    const executive = await ExecutiveAccount.findOne({
      username: normalizedUsername,
    });

    if (!executive) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    if (executive.status === "inactive") {
      return res.status(403).json({
        message: "This executive account has been deactivated",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      executive.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    const token = generateToken(
      executive._id,
      executive.role
    );
    setAuthCookie(req, res, token);

    return res.status(200).json({
      token,
      executive: formatExecutiveAccount(executive),
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
    const normalizedAdmissionNo = admission_no?.trim();

    if (!normalizedAdmissionNo || !password) {
      return res.status(400).json({
        message: missingLoginMessage("admission number"),
      });
    }

    const student = await Student.findOne({
      admission_no: {
        $regex: `^${escapeRegex(normalizedAdmissionNo)}$`,
        $options: "i"
      }
    });

    if (!student) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      student.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    const token = generateToken(
      student._id,
      "student"
    );
    setAuthCookie(req, res, token);

    return res.status(200).json({
      token,
      student: formatStudentAccount(student),
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
  clearAuthCookie(req, res);

  return res.status(200).json({
    message: "Logged out successfully",
  });
};

const teacherLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username?.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      return res.status(400).json({
        message: missingLoginMessage("username"),
      });
    }

    const teacher = await Teacher.findOne({
      username: normalizedUsername,
    });

    if (!teacher) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    if (teacher.status === "inactive") {
      return res.status(403).json({
        message: "This teacher account has been deactivated",
      });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);

    if (!isMatch) {
      return res.status(401).json({
        message: invalidLoginMessage,
      });
    }

    const token = generateToken(teacher._id, "teacher");
    setAuthCookie(req, res, token);

    return res.status(200).json({
      token,
      teacher: formatTeacherAccount(teacher),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    if (req.user.role === "student") {
      const student = await Student.findById(req.user.id);

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      return res.json({
        user: formatStudentAccount(student),
      });
    }

    if (req.user.role === "teacher") {
      const teacher = await Teacher.findById(req.user.id);

      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.status === "inactive") {
        clearAuthCookie(req, res);
        return res.status(403).json({
          message: "This teacher account has been deactivated",
        });
      }

      return res.json({
        user: formatTeacherAccount(teacher),
      });
    }

    if (["principal", "chairman"].includes(req.user.role)) {
      const executive = await ExecutiveAccount.findById(req.user.id);

      if (!executive) {
        return res.status(404).json({ message: "Executive account not found" });
      }

      if (executive.status === "inactive") {
        clearAuthCookie(req, res);
        return res.status(403).json({
          message: "This executive account has been deactivated",
        });
      }

      return res.json({
        user: formatExecutiveAccount(executive),
      });
    }

    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.json({
      user: formatAdminAccount(admin),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
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

const changeTeacherPassword = async (req, res) => {
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

    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    if (teacher.status === "inactive") {
      return res.status(403).json({
        message: "This teacher account has been deactivated",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, teacher.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    teacher.password = await bcrypt.hash(newPassword, 10);
    await teacher.save();

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
  executiveLogin,
  studentLogin,
  teacherLogin,
  changeStudentPassword,
  changeTeacherPassword,
  getCurrentUser,
  logout,
};
