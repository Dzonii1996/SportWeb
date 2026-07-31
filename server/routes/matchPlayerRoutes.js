const express = require("express");
const router = express.Router();

const {
  joinMatch,
} = require("../controllers/matchPlayerController");

router.post("/:id/join", joinMatch);

module.exports = router;