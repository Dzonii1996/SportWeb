const express = require("express");
const router = express.Router();

const {
  joinMatch,
  leaveMatch,
  getPlayers,
} = require("../controllers/matchPlayerController");
const { protect } = require("../middleware/authMiddleware");

router.post("/:id/join", protect, joinMatch);
router.delete("/:id/leave", protect, leaveMatch);
router.get("/:id/players", getPlayers);

module.exports = router;