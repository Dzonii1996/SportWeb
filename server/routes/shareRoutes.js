const express = require("express");
const router = express.Router();

const { shareMatch } = require("../controllers/shareController");

router.get("/matches/:id", shareMatch);

module.exports = router;
