const express = require("express");
const router = express.Router();

const { protect, optionalAuth } = require("../middleware/authMiddleware");
const {
  createTournament,
  updateTournament,
  getTournaments,
  getTournament,
  registerTeam,
  getInvite,
  joinTeam,
  removePlayer,
  withdrawTeam,
  approveTeam,
  rejectTeam,
  setTeamPaid,
  startTournament,
  saveResult,
  scheduleGame,
  cancelTournament,
} = require("../controllers/tournamentController");

router.get("/", getTournaments);
router.post("/", protect, createTournament);

// Pre "/:id", inače bi "invite" bio shvaćen kao ID turnira
router.get("/invite/:token", getInvite);
router.post("/invite/:token/join", protect, joinTeam);

router.get("/:id", optionalAuth, getTournament);
router.put("/:id", protect, updateTournament);
router.post("/:id/start", protect, startTournament);
router.post("/:id/cancel", protect, cancelTournament);

router.post("/:id/teams", protect, registerTeam);
router.delete("/:id/teams/:teamId", protect, withdrawTeam);
router.post("/:id/teams/:teamId/approve", protect, approveTeam);
router.post("/:id/teams/:teamId/reject", protect, rejectTeam);
router.put("/:id/teams/:teamId/paid", protect, setTeamPaid);
router.delete("/:id/teams/:teamId/players/:userId", protect, removePlayer);

router.put("/:id/games/:gameId/result", protect, saveResult);
router.put("/:id/games/:gameId/schedule", protect, scheduleGame);

module.exports = router;
