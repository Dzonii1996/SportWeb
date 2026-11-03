const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getMyReservations,
  getOwnerReservations,
  confirmReservation,
  rejectReservation,
  cancelReservation,
} = require("../controllers/reservationController");

// Zahtevi za rezervaciju se šalju na /api/venues/:id/reservations
router.get("/mine", protect, getMyReservations);
router.get("/owner", protect, getOwnerReservations);
router.post("/:reservationId/confirm", protect, confirmReservation);
router.post("/:reservationId/reject", protect, rejectReservation);
router.post("/:reservationId/cancel", protect, cancelReservation);

module.exports = router;
