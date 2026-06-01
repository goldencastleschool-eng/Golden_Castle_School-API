const Class = require("../models/classModel");

const Student = require("../models/studentModel");

const Result = require("../models/resultModel");

const normalizeClassName = (name = "") =>
  name.toString().trim().toLowerCase().replace(/\s+/g, "");

const defaultClasses = [
  "pg-1",
  "pg-2",
  "nur-1",
  "nur-2",
  "nur-3",
  "basic-1",
  "basic-2",
  "basic-3",
  "basic-4",
  "basic-5",
  "jss-1a",
  "jss1b",
  "jss2a",
  "jss3",
  "ss1",
  "ss2art",
  "ss2scienc"
];

const seedDefaultClasses = async () => {
  const classCount = await Class.countDocuments();

  if (classCount === 0) {
    await Class.insertMany(
      defaultClasses.map((name) => ({ name })),
      { ordered: false }
    );
  }
};

const getClasses = async (req, res) => {
  try {
    await seedDefaultClasses();

    const classes = await Class.find().sort({
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

    if (!name) {
      return res.status(400).json({
        message: "Class name is required"
      });
    }

    const existingClass = await Class.findOne({ name });

    if (existingClass) {
      return res.status(400).json({
        message: "Class already exists"
      });
    }

    const classRecord = await Class.create({ name });

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

    if (!name) {
      return res.status(400).json({
        message: "Class name is required"
      });
    }

    const classRecord = await Class.findById(req.params.id);

    if (!classRecord) {
      return res.status(404).json({
        message: "Class not found"
      });
    }

    const existingClass = await Class.findOne({ name });

    if (
      existingClass &&
      existingClass._id.toString() !== classRecord._id.toString()
    ) {
      return res.status(400).json({
        message: "Class already exists"
      });
    }

    const oldName = classRecord.name;
    classRecord.name = name;
    const updatedClass = await classRecord.save();

    await Student.updateMany(
      { class: oldName },
      { class: name }
    );

    await Result.updateMany(
      { class: oldName },
      { class: name }
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
      class: classRecord.name
    });

    const resultCount = await Result.countDocuments({
      class: classRecord.name
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
