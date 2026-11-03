const express = require("express");
const router = express.Router();

const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { uploadMany } = require("../middleware/upload");
const { requireAdmin } = require("../utils/admin");
const {
  MAX_IMAGES,
  getVenues,
  getAdminStatus,
  getAdminList,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  approveVenue,
  rejectVenue,
  addImages,
  deleteImage,
  requireManager,
} = require("../controllers/venueController");
const {
  claimVenue,
  getClaims,
  approveClaim,
  rejectClaim,
  removeOwner,
  getMyVenues,
} = require("../controllers/venueOwnerController");
const {
  updateSettings,
  getAvailability,
  createReservation,
} = require("../controllers/reservationController");
const {
  getReviews,
  saveReview,
  deleteReview,
} = require("../controllers/venueReviewController");

router.get("/", getVenues);

// Pre "/:id", inače bi "admin" bio shvaćen kao ID terena
router.get("/admin/status", protect, getAdminStatus);
router.get("/admin/list", protect, requireAdmin, getAdminList);
router.get("/admin/claims", protect, requireAdmin, getClaims);
router.post("/claims/:claimId/approve", protect, requireAdmin, approveClaim);
router.post("/claims/:claimId/reject", protect, requireAdmin, rejectClaim);
router.get("/mine", protect, getMyVenues);

router.get("/:id", optionalAuth, getVenue);

// Svako prijavljen može da predloži teren; admin ga dodaje odmah odobrenog
router.post("/", protect, createVenue);
// Podatke terena menjaju admin i vlasnik; brisanje i odobravanje samo admin
router.put("/:id", protect, requireManager, updateVenue);
router.delete("/:id", protect, requireAdmin, deleteVenue);
router.post("/:id/approve", protect, requireAdmin, approveVenue);
router.post("/:id/reject", protect, requireAdmin, rejectVenue);

router.post("/:id/images", protect, uploadMany("images", MAX_IMAGES), addImages);
router.delete("/:id/images/:imageId", protect, deleteImage);

// Ocene: svako prijavljen ocenjuje odobren teren (jednom, može da izmeni)
router.get("/:id/reviews", optionalAuth, getReviews);
router.put("/:id/reviews", protect, saveReview);
router.delete("/:id/reviews/:reviewId", protect, deleteReview);

// Vlasništvo: korisnik traži, admin odobrava (rute iznad) ili uklanja vlasnika
router.post("/:id/claim", protect, claimVenue);
router.delete("/:id/owner", protect, requireAdmin, removeOwner);

// Rezervacije: vlasnik podešava, svako prijavljen šalje zahtev
router.put("/:id/reservation-settings", protect, requireManager, updateSettings);
router.get("/:id/availability", getAvailability);
router.post("/:id/reservations", protect, createReservation);

module.exports = router;
