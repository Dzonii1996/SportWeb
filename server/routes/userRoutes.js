const express = require("express");
const router = express.Router();

const {
  getMyMatches,
} = require("../controllers/userController");

router.get("/:user_id/matches", getMyMatches);

module.exports = router;