const express = require("express");
const router = express.Router();

const {
  createMatch,
  getMatches
} = require("../controllers/matchController");


router.post("/", createMatch);

router.get("/", getMatches);


module.exports = router;