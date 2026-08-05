const express = require("express");
const router = express.Router();

const {
  joinMatch,
  leaveMatch,
  getPlayers,
} = require("../controllers/matchPlayerController");

router.post("/:id/join", joinMatch);
router.delete("/:id/leave", leaveMatch);
router.get("/:id/players", getPlayers);

module.exports = router;