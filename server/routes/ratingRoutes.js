const express = require("express");
const router = express.Router();

const {
  getMyRatings,
  rateParticipant,
} = require("../controllers/ratingController");
const { getMvp, voteMvp } = require("../controllers/mvpController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:id/ratings", protect, getMyRatings);
router.put("/:id/ratings/:playerId", protect, rateParticipant);
router.get("/:id/mvp", protect, getMvp);
router.put("/:id/mvp", protect, voteMvp);

module.exports = router;
