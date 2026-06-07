require("dotenv").config();
const mongoose = require("mongoose");
const Result = require("../models/resultModel");
const CumulativeResult = require("../models/cumulativeResultModel");
const ClassBroadsheet = require("../models/classBroadsheetModel");
const {
  deletePdfFile,
  uploadPdfBuffer
} = require("../utils/pdfStorage");

const MONGO_URI = process.env.MONGO_URI;

const migrateModel = async ({ label, Model, metadataType }) => {
  const records = await Model.find({
    pdf_data: { $exists: true },
    $or: [
      { pdf_file_id: { $exists: false } },
      { pdf_file_id: null }
    ]
  });

  console.log(`Found ${records.length} ${label} PDF records to migrate.`);

  for (const record of records) {
    if (!record.pdf_data?.length) {
      continue;
    }

    const fileName = record.file_name || `${record._id}.pdf`;
    const pdfFileId = await uploadPdfBuffer(record.pdf_data, {
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

    try {
      await Model.updateOne(
        { _id: record._id },
        {
          $set: {
            pdf_file_id: pdfFileId
          },
          $unset: {
            pdf_data: ""
          }
        }
      );

      console.log(`Migrated ${label} ${record._id}`);
    } catch (error) {
      await deletePdfFile(pdfFileId);
      throw error;
    }
  }
};

const run = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(MONGO_URI);

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

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
