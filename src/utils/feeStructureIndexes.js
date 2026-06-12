const FeeStructure = require("../models/feeStructureModel");

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
  const indexes = await FeeStructure.collection.indexes();
  const legacyIndexes = indexes.filter(isLegacyFeeStructureIndex);

  for (const index of legacyIndexes) {
    await FeeStructure.collection.dropIndex(index.name);
  }

  await FeeStructure.syncIndexes();
};

module.exports = {
  ensureFeeStructureIndexes
};
