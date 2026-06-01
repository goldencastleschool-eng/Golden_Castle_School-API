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
        term: ""
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

    const access = await ResultAccess.findOneAndUpdate(
      { key: ACCESS_KEY },
      {
        key: ACCESS_KEY,
        session,
        term
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
  ACCESS_KEY
};
