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
const { protect } = require("../middleware/authMiddleware");

router.post("/:id/join", protect, joinMatch);
router.delete("/:id/leave", protect, leaveMatch);
router.post("/:id/confirm", protect, confirmAttendance);
router.get("/:id/players", getPlayers);
router.post("/:id/teams", protect, splitTeams);
router.put("/:id/result", protect, setResult);
router.put("/:id/players/:userId/paid", protect, setPaid);

module.exports = router;