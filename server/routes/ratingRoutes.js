const express = require("express");
const router = express.Router();

const {
  getMyRatings,
  rateParticipant,
} = require("../controllers/ratingController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:id/ratings", protect, getMyRatings);
router.put("/:id/ratings/:playerId", protect, rateParticipant);

module.exports = router;
