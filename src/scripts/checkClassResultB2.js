require("dotenv").config();

const mongoose = require("mongoose");
const {
  HeadObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");

const ClassResult = require("../models/classResultModel");

const getEnv = (...keys) => keys.map((key) => process.env[key]).find(Boolean);

const createClient = () =>
  new S3Client({
    endpoint: getEnv("BACKBLAZE_B2_ENDPOINT", "B2_ENDPOINT", "S3_ENDPOINT"),
    region:
      getEnv("BACKBLAZE_B2_REGION", "B2_REGION", "AWS_REGION") ||
      "us-east-005",
    credentials: {
      accessKeyId: getEnv(
        "BACKBLAZE_B2_KEY_ID",
        "B2_KEY_ID",
        "AWS_ACCESS_KEY_ID"
      ),
      secretAccessKey: getEnv(
        "BACKBLAZE_B2_APPLICATION_KEY",
        "B2_APPLICATION_KEY",
        "AWS_SECRET_ACCESS_KEY"
      )
    },
    forcePathStyle: true
  });

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const recordId = process.argv[2];
  const record = recordId
    ? await ClassResult.findById(recordId).lean()
    : await ClassResult.findOne({
        pdf_storage: "backblaze_b2"
      })
        .sort({ updatedAt: -1 })
        .lean();

  if (!record) {
    console.log("No class result record found.");
    return;
  }

  const key = record.pdf_file_key || record.pdf_file_id;
  const bucket =
    record.pdf_bucket ||
    getEnv("BACKBLAZE_B2_BUCKET", "B2_BUCKET", "B2_BUCKET_NAME", "S3_BUCKET");

  console.log(
    JSON.stringify(
      {
        recordId: record._id,
        class: record.class,
        session: record.session,
        term: record.term,
        storage: record.pdf_storage,
        bucket,
        key,
        hasLegacyGridFsId: Boolean(record.legacy_pdf_file_id),
        expectedSize: record.pdf_size || 0,
        mimeType: record.pdf_mime_type
      },
      null,
      2
    )
  );

  try {
    const response = await createClient().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    console.log(
      JSON.stringify(
        {
          b2Readable: true,
          contentLength: response.ContentLength,
          contentType: response.ContentType
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          b2Readable: false,
          name: error.name,
          code: error.Code,
          message: error.message,
          status: error.$metadata?.httpStatusCode
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
};

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
