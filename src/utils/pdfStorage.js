const { randomUUID } = require("crypto");
const { Readable } = require("stream");

const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");

const GRIDFS_BUCKET_NAME = "pdfs";
const STORAGE_BACKBLAZE = "backblaze_b2";
const STORAGE_GRIDFS = "gridfs";

const getEnv = (...keys) => keys.map((key) => process.env[key]).find(Boolean);

const b2Config = {
  endpoint: getEnv("BACKBLAZE_B2_ENDPOINT", "B2_ENDPOINT", "S3_ENDPOINT"),
  region: getEnv("BACKBLAZE_B2_REGION", "B2_REGION", "AWS_REGION") || "us-east-005",
  bucket: getEnv("BACKBLAZE_B2_BUCKET", "B2_BUCKET", "B2_BUCKET_NAME", "S3_BUCKET"),
  keyId: getEnv("BACKBLAZE_B2_KEY_ID", "B2_KEY_ID", "AWS_ACCESS_KEY_ID"),
  applicationKey: getEnv(
    "BACKBLAZE_B2_APPLICATION_KEY",
    "B2_APPLICATION_KEY",
    "AWS_SECRET_ACCESS_KEY"
  )
};

const isB2Configured = () =>
  Boolean(
    b2Config.endpoint &&
      b2Config.bucket &&
      b2Config.keyId &&
      b2Config.applicationKey
  );

const getStorageDriver = () => {
  const requestedDriver = (
    process.env.PDF_STORAGE_DRIVER ||
    process.env.FILE_STORAGE_DRIVER ||
    ""
  ).toLowerCase();

  if (requestedDriver === STORAGE_GRIDFS) {
    return STORAGE_GRIDFS;
  }

  return isB2Configured() ? STORAGE_BACKBLAZE : STORAGE_GRIDFS;
};

let s3Client;

const getS3Client = () => {
  if (!isB2Configured()) {
    throw new Error("Backblaze B2 PDF storage is not configured");
  }

  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: b2Config.endpoint,
      region: b2Config.region,
      credentials: {
        accessKeyId: b2Config.keyId,
        secretAccessKey: b2Config.applicationKey
      },
      forcePathStyle: true
    });
  }

  return s3Client;
};

const getPdfBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready");
  }

  return new GridFSBucket(mongoose.connection.db, {
    bucketName: GRIDFS_BUCKET_NAME
  });
};

const isObjectIdLike = (fileId) => {
  if (!fileId) {
    return false;
  }

  if (fileId instanceof ObjectId) {
    return true;
  }

  return ObjectId.isValid(fileId.toString());
};

const normalizeFileId = (fileId) => {
  if (!isObjectIdLike(fileId)) {
    return null;
  }

  if (fileId instanceof ObjectId) {
    return fileId;
  }

  return new ObjectId(fileId.toString());
};

const sanitizePathPart = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");

const createB2ObjectKey = ({ fileName, metadata = {} }) => {
  const type = sanitizePathPart(metadata.type || "pdf");
  const session = sanitizePathPart(metadata.session || "unspecified-session");
  const term = sanitizePathPart(metadata.term || "all-terms");
  const safeFileName = sanitizePathPart(fileName || "document.pdf") || "document.pdf";

  return [
    "pdfs",
    type,
    session,
    term,
    `${Date.now()}-${randomUUID()}-${safeFileName}`
  ].join("/");
};

const normalizeMetadata = (metadata = {}) =>
  Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, value.toString()])
  );

const uploadToGridFs = (buffer, { fileName, contentType, metadata = {} }) =>
  new Promise((resolve, reject) => {
    const bucket = getPdfBucket();
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: contentType || "application/pdf",
      metadata
    });

    uploadStream.once("error", reject);
    uploadStream.once("finish", () =>
      resolve({
        storage: STORAGE_GRIDFS,
        fileId: uploadStream.id,
        contentType: contentType || "application/pdf",
        fileName,
        size: buffer.length,
        uploadedAt: new Date()
      })
    );
    uploadStream.end(buffer);
  });

const uploadToBackblaze = async (buffer, { fileName, contentType, metadata = {} }) => {
  const key = createB2ObjectKey({ fileName, metadata });
  const mimeType = contentType || "application/pdf";

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: b2Config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: normalizeMetadata(metadata)
    })
  );

  return {
    storage: STORAGE_BACKBLAZE,
    fileId: key,
    fileKey: key,
    bucket: b2Config.bucket,
    contentType: mimeType,
    fileName,
    size: buffer.length,
    uploadedAt: new Date()
  };
};

const uploadPdfBuffer = async (buffer, options = {}) => {
  if (getStorageDriver() === STORAGE_BACKBLAZE) {
    return uploadToBackblaze(buffer, options);
  }

  return uploadToGridFs(buffer, options);
};

const getPdfStorageFields = (uploadResult, { contentType, fileName } = {}) => ({
  pdf_storage: uploadResult.storage,
  pdf_file_id: uploadResult.fileId,
  pdf_file_key: uploadResult.fileKey || "",
  pdf_bucket: uploadResult.bucket || "",
  pdf_mime_type: uploadResult.contentType || contentType || "application/pdf",
  pdf_size: uploadResult.size || 0,
  pdf_uploaded_at: uploadResult.uploadedAt || new Date(),
  file_name: uploadResult.fileName || fileName
});

const isBackblazeReference = ({ storage, fileId, fileKey } = {}) =>
  storage === STORAGE_BACKBLAZE || Boolean(fileKey) || !isObjectIdLike(fileId);

const resolveDeleteReference = (fileReference) => {
  if (!fileReference) {
    return {};
  }

  if (typeof fileReference === "string" || fileReference instanceof ObjectId) {
    return {
      fileId: fileReference
    };
  }

  return {
    storage: fileReference.pdf_storage || fileReference.storage,
    fileId: fileReference.pdf_file_id || fileReference.fileId,
    fileKey: fileReference.pdf_file_key || fileReference.fileKey,
    bucket: fileReference.pdf_bucket || fileReference.bucket
  };
};

const deletePdfFile = async (fileReference) => {
  const reference = resolveDeleteReference(fileReference);
  const key = reference.fileKey || reference.fileId;

  if (!key) {
    return;
  }

  if (isBackblazeReference(reference)) {
    if (!isB2Configured()) {
      return;
    }

    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: reference.bucket || b2Config.bucket,
        Key: key.toString()
      })
    );
    return;
  }

  const normalizedFileId = normalizeFileId(key);

  if (!normalizedFileId) {
    return;
  }

  try {
    await getPdfBucket().delete(normalizedFileId);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const streamToBuffer = async (stream) => {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const readBackblazeBuffer = async ({ fileId, fileKey, bucket }) => {
  const key = fileKey || fileId;

  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket || b2Config.bucket,
      Key: key.toString()
    })
  );

  return streamToBuffer(response.Body);
};

const readGridFsBuffer = (fileId) =>
  new Promise((resolve, reject) => {
    const normalizedFileId = normalizeFileId(fileId);

    if (!normalizedFileId) {
      reject(new Error("Invalid GridFS file id"));
      return;
    }

    const chunks = [];
    const stream = getPdfBucket().openDownloadStream(normalizedFileId);

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  });

const readPdfBuffer = async ({
  storage,
  fileId,
  fileKey,
  bucket,
  fallbackBuffer
}) => {
  if (isBackblazeReference({ storage, fileId, fileKey })) {
    return readBackblazeBuffer({ fileId, fileKey, bucket });
  }

  if (fileId) {
    return readGridFsBuffer(fileId);
  }

  if (fallbackBuffer?.length) {
    return fallbackBuffer;
  }

  throw new Error("PDF file is not available");
};

const sendPdfFile = async ({
  res,
  storage,
  fileId,
  fileKey,
  bucket,
  fallbackBuffer,
  fileName,
  contentType,
  dispositionType,
  unavailableMessage
}) => {
  if (isBackblazeReference({ storage, fileId, fileKey })) {
    const key = fileKey || fileId;

    if (key && isB2Configured()) {
      try {
        const [headResponse, objectResponse] = await Promise.all([
          getS3Client().send(
            new HeadObjectCommand({
              Bucket: bucket || b2Config.bucket,
              Key: key.toString()
            })
          ),
          getS3Client().send(
            new GetObjectCommand({
              Bucket: bucket || b2Config.bucket,
              Key: key.toString()
            })
          )
        ]);

        res.setHeader(
          "Content-Type",
          headResponse.ContentType || contentType || "application/pdf"
        );
        res.setHeader(
          "Content-Disposition",
          `${dispositionType}; filename="${fileName}"`
        );

        if (headResponse.ContentLength) {
          res.setHeader("Content-Length", headResponse.ContentLength);
        }

        if (typeof objectResponse.Body?.pipe === "function") {
          return objectResponse.Body.pipe(res);
        }

        return Readable.from(objectResponse.Body).pipe(res);
      } catch (error) {
        if (!fallbackBuffer?.length) {
          return res.status(404).json({
            message: unavailableMessage
          });
        }
      }
    }
  }

  const normalizedFileId = normalizeFileId(fileId);

  if (normalizedFileId) {
    const gridFsBucket = getPdfBucket();
    const [file] = await gridFsBucket.find({
      _id: normalizedFileId
    }).toArray();

    if (!file) {
      return res.status(404).json({
        message: unavailableMessage
      });
    }

    res.setHeader("Content-Type", file.contentType || contentType || "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${fileName}"`);
    res.setHeader("Content-Length", file.length);

    return gridFsBucket.openDownloadStream(normalizedFileId).pipe(res);
  }

  if (fallbackBuffer?.length) {
    res.setHeader("Content-Type", contentType || "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${fileName}"`);
    res.setHeader("Content-Length", fallbackBuffer.length);

    return res.send(fallbackBuffer);
  }

  return res.status(404).json({
    message: unavailableMessage
  });
};

module.exports = {
  STORAGE_BACKBLAZE,
  STORAGE_GRIDFS,
  deletePdfFile,
  getPdfStorageFields,
  readPdfBuffer,
  sendPdfFile,
  uploadPdfBuffer
};
