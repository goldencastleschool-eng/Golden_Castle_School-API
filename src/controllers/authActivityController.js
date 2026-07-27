const AuthActivity = require("../models/authActivityModel");

const allowedRoles = ["student", "teacher", "admin", "principal", "chairman"];
const allowedActions = ["login", "logout"];

const getAuthActivity = async (req, res) => {
  try {
    const {
      role,
      action,
      date_from,
      date_to,
      limit = 100,
      page = 1,
    } = req.query;
    const query = {};

    if (allowedRoles.includes(role)) {
      query.role = role;
    }

    if (allowedActions.includes(action)) {
      query.action = action;
    }

    if (date_from || date_to) {
      query.occurred_at = {};

      if (date_from) {
        query.occurred_at.$gte = new Date(date_from);
      }

      if (date_to) {
        const endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
        query.occurred_at.$lte = endDate;
      }
    }

    const pageSize = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const pageNumber = Math.max(Number(page) || 1, 1);
    const skip = (pageNumber - 1) * pageSize;

    const [records, total] = await Promise.all([
      AuthActivity.find(query)
        .sort({ occurred_at: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      AuthActivity.countDocuments(query),
    ]);

    return res.json({
      records,
      total,
      page: pageNumber,
      limit: pageSize,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getAuthActivity,
};
