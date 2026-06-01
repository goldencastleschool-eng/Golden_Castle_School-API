require("dotenv").config();

const https = require("https");
const mongoose = require("mongoose");

const Result = require("../models/resultModel");

const createSafeFileName = (...parts) => {
  return `${parts.filter(Boolean).join("-")}-result.pdf`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const downloadPdf = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode >= 400) {
          reject(new Error(`Download failed with ${response.statusCode}`));
          return;
        }

        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });

const migrateResults = async () => {
  const legacyResults = await Result.collection
    .find({
      pdf_url: { $exists: true },
      pdf_data: { $exists: false }
    })
    .toArray();

  console.log(`Found ${legacyResults.length} legacy result record(s).`);

  for (const result of legacyResults) {
    const pdfBuffer = await downloadPdf(result.pdf_url);

    if (pdfBuffer.subarray(0, 4).toString() !== "%PDF") {
      throw new Error(`Legacy file is not a valid PDF: ${result._id}`);
    }

    const fileName =
      result.file_name ||
      createSafeFileName(result.term, result.session, result._id.toString());

    await Result.collection.updateOne(
      { _id: result._id },
      {
        $set: {
          pdf_data: pdfBuffer,
          pdf_mime_type: "application/pdf",
          file_name: fileName
        },
        $unset: {
          pdf_url: "",
          public_id: ""
        }
      }
    );

    console.log(`Migrated result ${result._id}`);
  }
};

mongoose
  .connect(process.env.MONGO_URI)
  .then(migrateResults)
  .then(() => mongoose.disconnect())
  .then(() => {
    console.log("Result PDF migration complete.");
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
