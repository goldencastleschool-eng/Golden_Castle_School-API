const ResultAccess = require("../models/resultAccessModel");

const ACCESS_KEY = "active-result-access";

const getResultAccess = async (req, res) => {
  try {
    const access = await ResultAccess.findOne({
      key: ACCESS_KEY
    });

    res.json(
      access || {
        key: ACCESS_KEY,
        session: "",
        term: "",
        cumulative_session: ""
      }
    );

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateResultAccess = async (req, res) => {
  try {
    const { session, term } = req.body;

    if (!session || !term) {
      return res.status(400).json({
        message: "Session and term are required"
      });
    }

    const existingAccess = await ResultAccess.findOne({
      key: ACCESS_KEY
    });

    const access = await ResultAccess.findOneAndUpdate(
      { key: ACCESS_KEY },
      {
        key: ACCESS_KEY,
        session,
        term,
        cumulative_session: existingAccess?.cumulative_session || ""
      },
      {
        new: true,
        upsert: true
      }
    );

    res.json(access);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateCumulativeResultAccess = async (req, res) => {
  try {
    const {
      cumulative_session,
      session
    } = req.body;

    const approvedSession = cumulative_session || session;

    if (!approvedSession) {
      return res.status(400).json({
        message: "Cumulative result session is required"
      });
    }

    const existingAccess = await ResultAccess.findOne({
      key: ACCESS_KEY
    });

    const access = await ResultAccess.findOneAndUpdate(
      { key: ACCESS_KEY },
      {
        key: ACCESS_KEY,
        session: existingAccess?.session || "",
        term: existingAccess?.term || "",
        cumulative_session: approvedSession
      },
      {
        new: true,
        upsert: true
      }
    );

    res.json(access);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getResultAccess,
  updateResultAccess,
  updateCumulativeResultAccess,
  ACCESS_KEY
};
