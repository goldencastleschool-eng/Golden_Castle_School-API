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
        cumulative_session: "",
        broadsheet_session: "",
        broadsheet_term: ""
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
        cumulative_session: existingAccess?.cumulative_session || "",
        broadsheet_session: existingAccess?.broadsheet_session || "",
        broadsheet_term: existingAccess?.broadsheet_term || ""
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
        cumulative_session: approvedSession,
        broadsheet_session: existingAccess?.broadsheet_session || "",
        broadsheet_term: existingAccess?.broadsheet_term || ""
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

const updateBroadsheetAccess = async (req, res) => {
  try {
    const { broadsheet_session, broadsheet_term, session, term } = req.body;
    const approvedSession = broadsheet_session || session;
    const approvedTerm = broadsheet_term || term;

    if (!approvedSession || !approvedTerm) {
      return res.status(400).json({
        message: "Broadsheet session and term are required"
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
        cumulative_session: existingAccess?.cumulative_session || "",
        broadsheet_session: approvedSession,
        broadsheet_term: approvedTerm
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
  updateBroadsheetAccess,
  ACCESS_KEY
};
