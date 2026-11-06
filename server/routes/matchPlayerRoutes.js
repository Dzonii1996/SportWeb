const express = require("express");
const router = express.Router();

const {
  joinMatch,
  leaveMatch,
  getPlayers,
  setPaid,
  confirmAttendance,
} = require("../controllers/matchPlayerController");
const { splitTeams } = require("../controllers/teamController");
const { setResult } = require("../controllers/resultController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requireVisible } = require("../utils/privacy");

router.post("/:id/join", protect, requireVisible, joinMatch);
router.delete("/:id/leave", protect, leaveMatch);
router.post("/:id/confirm", protect, confirmAttendance);
router.get("/:id/players", optionalAuth, requireVisible, getPlayers);
router.post("/:id/teams", protect, splitTeams);
router.put("/:id/result", protect, setResult);
router.put("/:id/players/:playerId/paid", protect, setPaid);

module.exports = router;