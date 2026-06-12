const FeeStructure = require("../models/feeStructureModel");

let feeStructureIndexesPromise = null;

const isLegacyFeeStructureIndex = (index) => {
  const keyFields = Object.keys(index.key || {});

  return (
    index.unique &&
    keyFields.includes("class_record") &&
    keyFields.includes("session") &&
    keyFields.includes("term") &&
    !keyFields.includes("fee_category")
  );
};

const ensureFeeStructureIndexes = async () => {
  if (feeStructureIndexesPromise) {
    return feeStructureIndexesPromise;
  }

  feeStructureIndexesPromise = (async () => {
    const indexes = await FeeStructure.collection.indexes();
    const legacyIndexes = indexes.filter(isLegacyFeeStructureIndex);

    for (const index of legacyIndexes) {
      await FeeStructure.collection.dropIndex(index.name);
    }

    await FeeStructure.createIndexes();
  })();

  try {
    return await feeStructureIndexesPromise;
  } catch (error) {
    feeStructureIndexesPromise = null;
    throw error;
  }
};

module.exports = {
  ensureFeeStructureIndexes
};
