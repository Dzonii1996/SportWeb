const express = require("express");
const router = express.Router();

const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { uploadMany } = require("../middleware/upload");
const photos = require("../controllers/photoController");

// Fotografije: galerija (/api/photos) i slike turnira i termina.
// Rute za turnir i termin se kače na /api/tournaments i /api/matches.
const PHOTO_SIZE_MB = 10;
const upload = uploadMany("photos", photos.MAX_UPLOAD, { maxSizeMb: PHOTO_SIZE_MB });

const gallery = express.Router();
gallery.get("/", photos.getGallery);
gallery.delete("/:photoId", protect, photos.deletePhoto);
gallery.post("/:photoId/report", protect, photos.reportPhoto);

const tournament = express.Router();
tournament.get("/:id/photos", optionalAuth, photos.getTournamentPhotos);
tournament.post("/:id/photos", protect, upload, photos.addTournamentPhotos);

const match = express.Router();
match.get("/:id/photos", optionalAuth, photos.getMatchPhotos);
match.post("/:id/photos", protect, upload, photos.addMatchPhotos);

router.use("/api/photos", gallery);
router.use("/api/tournaments", tournament);
router.use("/api/matches", match);

module.exports = router;
