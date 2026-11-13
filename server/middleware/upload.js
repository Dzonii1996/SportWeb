const { msg } = require("../utils/i18n");
const fs = require("fs");
const multer = require("multer");

// Dozvoljeni tipovi slika i ekstenzija pod kojom se čuvaju.
// Ekstenziju određujemo mi, da server nikad ne vrati npr. .html fajl.
const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_SIZE_MB = 5;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    const random = Math.round(Math.random() * 1e9);
    cb(null, `${Date.now()}-${random}${ALLOWED_TYPES[file.mimetype]}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(msg("common.onlyImagesAreAllowedJpg")));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

// Greške multer-a vraćamo kao JSON umesto opšte greške servera
const sendUploadError = (res, err, maxFiles = 1, maxSizeMb = MAX_SIZE_MB) => {
  const messages = {
    LIMIT_FILE_SIZE: msg("common.anImageCanBeAt", { n: maxSizeMb }),
    LIMIT_FILE_COUNT: msg("common.youCanSendAtMost", { n: maxFiles }),
    LIMIT_UNEXPECTED_FILE: msg("common.youCanSendAtMost", { n: maxFiles }),
  };

  res.status(400).json({
    success: false,
    message: messages[err.code] || err.message,
  });
};

// Kao upload.single, ali greške vraća kao JSON
const uploadSingle = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();

    sendUploadError(res, err);
  });
};

// Više slika odjednom (npr. slike terena); fajlovi su u req.files.
// maxSizeMb: fotografije sa telefona su veće, server ih posle smanji.
const uploadMany = (field, maxFiles, { maxSizeMb = MAX_SIZE_MB } = {}) => {
  const many = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSizeMb * 1024 * 1024,
      files: maxFiles,
    },
  });

  return (req, res, next) => {
    many.array(field, maxFiles)(req, res, (err) => {
      if (!err) return next();

      // Slike sačuvane pre greške ne ostavljamo na disku
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));

      sendUploadError(res, err, maxFiles, maxSizeMb);
    });
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMany,
};
