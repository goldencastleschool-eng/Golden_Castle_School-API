const Class = require("../models/classModel");

const Student = require("../models/studentModel");

const Result = require("../models/resultModel");

const {
  ensureClassRecord,
  normalizeClassName,
  normalizeSession,
  syncLegacyClassesToDynamicRecords
} = require("../utils/classRecords");

const getClasses = async (req, res) => {
  try {
    await syncLegacyClassesToDynamicRecords();

    const classes = await Class.find({
      session: { $exists: true, $ne: "" }
    }).sort({
      session: -1,
      name: 1
    });

    res.json(classes);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const createClass = async (req, res) => {
  try {
    const name = normalizeClassName(req.body.name);
    const session = normalizeSession(req.body.session);

    if (!name) {
      return res.status(400).json({
        message: "Class name is required"
      });
    }

    if (!session) {
      return res.status(400).json({
        message: "Session is required"
      });
    }

    const existingClass = await Class.findOne({
      name,
      session
    });

    if (existingClass) {
      return res.status(400).json({
        message: "Class already exists for this session"
      });
    }

    const classRecord = await ensureClassRecord(name, session);

    res.status(201).json(classRecord);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const updateClass = async (req, res) => {
  try {
    const name = normalizeClassName(req.body.name);
    const session = normalizeSession(req.body.session);

    if (!name) {
      return res.status(400).json({
        message: "Class name is required"
      });
    }

    if (!session) {
      return res.status(400).json({
        message: "Session is required"
      });
    }

    const classRecord = await Class.findById(req.params.id);

    if (!classRecord) {
      return res.status(404).json({
        message: "Class not found"
      });
    }

    const existingClass = await Class.findOne({
      name,
      session
    });

    if (
      existingClass &&
      existingClass._id.toString() !== classRecord._id.toString()
    ) {
      return res.status(400).json({
        message: "Class already exists for this session"
      });
    }

    const oldName = classRecord.name;
    const oldSession = classRecord.session;
    classRecord.name = name;
    classRecord.session = session;
    const updatedClass = await classRecord.save();

    await Student.updateMany(
      {
        $or: [
          { class_record: classRecord._id },
          {
            class: oldName,
            current_session: oldSession
          }
        ]
      },
      {
        class: name,
        current_session: session,
        class_record: classRecord._id
      }
    );

    await Result.updateMany(
      {
        class: oldName,
        session: oldSession
      },
      {
        class: name,
        session
      }
    );

    res.json(updatedClass);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

const deleteClass = async (req, res) => {
  try {
    const classRecord = await Class.findById(req.params.id);

    if (!classRecord) {
      return res.status(404).json({
        message: "Class not found"
      });
    }

    const studentCount = await Student.countDocuments({
      $or: [
        { class_record: classRecord._id },
        {
          class: classRecord.name,
          current_session: classRecord.session
        }
      ]
    });

    const resultCount = await Result.countDocuments({
      class: classRecord.name,
      session: classRecord.session
    });

    if (studentCount > 0 || resultCount > 0) {
      return res.status(400).json({
        message: "Cannot delete a class with students or results"
      });
    }

    await classRecord.deleteOne();

    res.json({
      message: "Class deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

module.exports = {
  getClasses,
  createClass,
  updateClass,
  deleteClass
};
