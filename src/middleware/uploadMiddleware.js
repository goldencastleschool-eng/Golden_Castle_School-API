const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files allowed"));
    }
  }
});

const handleUploadError = (error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "PDF file must not be larger than 5MB"
        : error.message;

    return res.status(400).json({
      message
    });
  }

  return res.status(400).json({
    message: error.message || "Unable to process uploaded file"
  });
};

module.exports = upload;
module.exports.handleUploadError = handleUploadError;
