const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");

const BUCKET_NAME = "pdfs";

const getPdfBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready");
  }

  return new GridFSBucket(mongoose.connection.db, {
    bucketName: BUCKET_NAME
  });
};

const normalizeFileId = (fileId) => {
  if (!fileId) {
    return null;
  }

  if (fileId instanceof ObjectId) {
    return fileId;
  }

  return new ObjectId(fileId.toString());
};

const uploadPdfBuffer = (buffer, { fileName, contentType, metadata = {} }) =>
  new Promise((resolve, reject) => {
    const bucket = getPdfBucket();
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: contentType || "application/pdf",
      metadata
    });

    uploadStream.once("error", reject);
    uploadStream.once("finish", () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });

const deletePdfFile = async (fileId) => {
  const normalizedFileId = normalizeFileId(fileId);

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

const sendPdfFile = async ({
  res,
  fileId,
  fallbackBuffer,
  fileName,
  contentType,
  dispositionType,
  unavailableMessage
}) => {
  const normalizedFileId = normalizeFileId(fileId);

  if (normalizedFileId) {
    const bucket = getPdfBucket();
    const [file] = await bucket.find({
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

    return bucket.openDownloadStream(normalizedFileId).pipe(res);
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
  uploadPdfBuffer,
  deletePdfFile,
  sendPdfFile
};
