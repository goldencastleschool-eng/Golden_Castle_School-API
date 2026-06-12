require("dotenv").config();

const mongoose = require("mongoose");

const Class = require("../models/classModel");
const ClassBroadsheet = require("../models/classBroadsheetModel");
const ClassResult = require("../models/classResultModel");
const CumulativeResult = require("../models/cumulativeResultModel");
const Fee = require("../models/feeModel");
const FeeStructure = require("../models/feeStructureModel");
const Result = require("../models/resultModel");
const Student = require("../models/studentModel");
const Teacher = require("../models/teacherModel");

const mode = process.argv.includes("--sync") ? "sync" : "report";

const searchableModels = [
  Student,
  Teacher,
  Class,
  Result,
  CumulativeResult,
  ClassResult,
  ClassBroadsheet,
  Fee,
  FeeStructure
];

const hasTextIndexKey = (indexKey = {}) =>
  Object.values(indexKey).some((value) => value === "text");

const getDeclaredTextIndex = (model) => {
  const schemaIndex = model.schema.indexes().find(([indexKey]) =>
    hasTextIndexKey(indexKey)
  );

  if (!schemaIndex) {
    return null;
  }

  const [key, options = {}] = schemaIndex;

  return {
    name: options.name || "",
    key,
    weights: options.weights || {}
  };
};

const getExistingTextIndexes = (indexes = []) =>
  indexes
    .filter((index) => hasTextIndexKey(index.key))
    .map((index) => ({
      name: index.name,
      key: index.key,
      weights: index.weights || {}
    }));

const buildCollectionReport = async (model) => {
  const collection = model.collection;
  const existingIndexes = await collection.indexes();
  const declaredTextIndex = getDeclaredTextIndex(model);
  const existingTextIndexes = getExistingTextIndexes(existingIndexes);
  const hasDeclaredTextIndex =
    declaredTextIndex &&
    existingTextIndexes.some((index) => index.name === declaredTextIndex.name);
  const conflictingTextIndexes = declaredTextIndex
    ? existingTextIndexes.filter((index) => index.name !== declaredTextIndex.name)
    : existingTextIndexes;

  return {
    model: model.modelName,
    collection: collection.collectionName,
    declared_text_index: declaredTextIndex,
    existing_text_indexes: existingTextIndexes,
    has_declared_text_index: Boolean(hasDeclaredTextIndex),
    conflicting_text_indexes: conflictingTextIndexes,
    normal_index_count: existingIndexes.length
  };
};

const syncModelIndexes = async (model, collectionReport) => {
  if (!collectionReport.declared_text_index) {
    return {
      status: "skipped",
      reason: "No declared text index"
    };
  }

  if (collectionReport.conflicting_text_indexes.length > 0) {
    return {
      status: "skipped",
      reason:
        "Collection already has a different text index. Drop or rename it manually before syncing.",
      conflicts: collectionReport.conflicting_text_indexes
    };
  }

  await model.createIndexes();

  return {
    status: "synced",
    reason: "Declared indexes created or already present"
  };
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 15000
  });

  const beforeReports = [];
  const syncResults = [];

  for (const model of searchableModels) {
    const collectionReport = await buildCollectionReport(model);
    beforeReports.push(collectionReport);

    if (mode === "sync") {
      const syncResult = await syncModelIndexes(model, collectionReport);

      syncResults.push({
        model: model.modelName,
        collection: model.collection.collectionName,
        ...syncResult
      });
    }
  }

  const afterReports = [];

  if (mode === "sync") {
    for (const model of searchableModels) {
      afterReports.push(await buildCollectionReport(model));
    }
  }

  const finalReports = mode === "sync" ? afterReports : beforeReports;

  console.log(
    JSON.stringify(
      {
        mode,
        database: mongoose.connection.db.databaseName,
        checked_at: new Date().toISOString(),
        collections_checked: searchableModels.length,
        collections_with_declared_text_indexes: finalReports.filter(
          (report) => Boolean(report.declared_text_index)
        ).length,
        collections_with_existing_text_indexes: finalReports.filter(
          (report) => report.existing_text_indexes.length > 0
        ).length,
        sync_results: syncResults,
        collections: finalReports
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          error: error.message
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
