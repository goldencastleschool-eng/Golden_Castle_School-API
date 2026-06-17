require("dotenv").config();

const mongoose = require("mongoose");

const Result = require("../models/resultModel");
const CumulativeResult = require("../models/cumulativeResultModel");
const ClassBroadsheet = require("../models/classBroadsheetModel");
const ClassResult = require("../models/classResultModel");
const {
  STORAGE_BACKBLAZE,
  deletePdfFile,
  getPdfStorageFields,
  readPdfBuffer,
  uploadPdfBuffer
} = require("../utils/pdfStorage");

const MONGO_URI = process.env.MONGO_URI;
const BATCH_SIZE = Number(process.env.PDF_MIGRATION_BATCH_SIZE || 10);
const MAX_RETRIES = Number(process.env.PDF_MIGRATION_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.PDF_MIGRATION_RETRY_DELAY_MS || 3000);

const fileExistsQuery = {
  $or: [
    { pdf_file_id: { $exists: true, $ne: null } },
    { pdf_data: { $exists: true, $ne: null } }
  ]
};

const legacyStorageQuery = {
  $or: [
    { pdf_storage: { $exists: false } },
    { pdf_storage: { $ne: STORAGE_BACKBLAZE } }
  ]
};

const sleep = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const isTransientMongoError = (error) => {
  const labels = Array.from(error?.errorLabelSet || []);
  const message = error?.message || "";
  const name = error?.name || "";

  return (
    labels.some((label) =>
      ["PoolRequstedRetry", "PoolRequestedRetry", "ResetPool"].includes(label)
    ) ||
    name.includes("MongoNetwork") ||
    name.includes("MongoServerSelection") ||
    message.includes("server monitor timeout") ||
    message.includes("PoolClearedOnNetworkError") ||
    message.includes("connection") && message.includes("timed out")
  );
};

const withRetry = async (operation, label) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientMongoError(error) || attempt === MAX_RETRIES) {
        break;
      }

      const delay = RETRY_DELAY_MS * attempt;
      console.warn(
        `${label} failed with a transient MongoDB error. Retrying in ${delay}ms (${attempt}/${MAX_RETRIES})...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
};

const getPendingRecords = (Model) =>
  withRetry(
    () =>
      Model.find({
        $and: [fileExistsQuery, legacyStorageQuery]
      })
        .sort({ _id: 1 })
        .limit(BATCH_SIZE),
    "Loading migration batch"
  );

const migrateRecord = async ({ label, record, metadataType }) => {
  const fileName = record.file_name || `${record._id}.pdf`;
  const legacyPdfFileId = record.pdf_file_id;

  const pdfBuffer = await withRetry(
    () =>
      readPdfBuffer({
        storage: record.pdf_storage,
        fileId: record.pdf_file_id,
        fileKey: record.pdf_file_key,
        bucket: record.pdf_bucket,
        fallbackBuffer: record.pdf_data
      }),
    `Reading ${label} ${record._id}`
  );

  if (pdfBuffer.subarray(0, 4).toString() !== "%PDF") {
    throw new Error(`${label} ${record._id} is not a valid PDF`);
  }

  const pdfUpload = await uploadPdfBuffer(pdfBuffer, {
    fileName,
    contentType: record.pdf_mime_type || "application/pdf",
    metadata: {
      type: metadataType,
      source_record_id: record._id.toString(),
      session: record.session,
      term: record.term,
      class: record.class
    }
  });

  if (pdfUpload.storage !== STORAGE_BACKBLAZE) {
    await deletePdfFile(pdfUpload);
    throw new Error(
      "Backblaze B2 is not configured. Set BACKBLAZE_B2_ENDPOINT, BACKBLAZE_B2_BUCKET, BACKBLAZE_B2_KEY_ID, and BACKBLAZE_B2_APPLICATION_KEY."
    );
  }

  try {
    await withRetry(
      () =>
        record.constructor.updateOne(
          { _id: record._id },
          {
            $set: {
              ...getPdfStorageFields(pdfUpload, {
                contentType: record.pdf_mime_type || "application/pdf",
                fileName
              }),
              legacy_pdf_file_id: legacyPdfFileId,
              pdf_migrated_at: new Date()
            }
          }
        ),
      `Updating ${label} ${record._id}`
    );
  } catch (error) {
    await deletePdfFile(pdfUpload).catch((deleteError) => {
      console.warn(
        `Unable to clean up uploaded B2 object for ${label} ${record._id}: ${deleteError.message}`
      );
    });
    throw error;
  }
};

const migrateModel = async ({ label, Model, metadataType }) => {
  let migratedCount = 0;
  let failedCount = 0;

  while (true) {
    const records = await getPendingRecords(Model);

    if (records.length === 0) {
      break;
    }

    console.log(`Processing ${records.length} ${label} PDF record(s).`);
    let batchMigratedCount = 0;

    for (const record of records) {
      try {
        await migrateRecord({ label, record, metadataType });
        migratedCount += 1;
        batchMigratedCount += 1;
        console.log(`Migrated ${label} ${record._id}`);
      } catch (error) {
        failedCount += 1;
        console.error(`Failed ${label} ${record._id}: ${error.message}`);
      }
    }

    if (records.length > 0 && batchMigratedCount === 0) {
      throw new Error(
        `No ${label} records migrated in the latest batch. Resolve the logged errors before retrying.`
      );
    }
  }

  console.log(
    `${label} migration finished. Migrated: ${migratedCount}. Failed: ${failedCount}.`
  );
};

const connectWithRetry = () =>
  withRetry(
    () =>
      mongoose.connect(MONGO_URI, {
        maxPoolSize: Number(process.env.PDF_MIGRATION_MONGO_POOL_SIZE || 5),
        serverSelectionTimeoutMS: Number(
          process.env.PDF_MIGRATION_SERVER_SELECTION_TIMEOUT_MS || 30000
        ),
        socketTimeoutMS: Number(
          process.env.PDF_MIGRATION_SOCKET_TIMEOUT_MS || 120000
        ),
        connectTimeoutMS: Number(
          process.env.PDF_MIGRATION_CONNECT_TIMEOUT_MS || 30000
        )
      }),
    "Connecting to MongoDB"
  );

const run = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await connectWithRetry();

  await migrateModel({
    label: "termly result",
    Model: Result,
    metadataType: "termly-result"
  });

  await migrateModel({
    label: "cumulative result",
    Model: CumulativeResult,
    metadataType: "cumulative-result"
  });

  await migrateModel({
    label: "class broadsheet",
    Model: ClassBroadsheet,
    metadataType: "class-broadsheet"
  });

  await migrateModel({
    label: "class result",
    Model: ClassResult,
    metadataType: "class-result"
  });

  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  run
};
