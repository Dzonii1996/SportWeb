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
    cb(new Error("Dozvoljene su samo slike (JPG, PNG, WEBP)."));
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

// Kao upload.single, ali greške vraća kao JSON umesto opšte greške servera
const uploadSingle = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();

    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `Slika može imati najviše ${MAX_SIZE_MB} MB.`
        : err.message;

    res.status(400).json({
      success: false,
      message,
    });
  });
};

module.exports = {
  upload,
  uploadSingle,
};
