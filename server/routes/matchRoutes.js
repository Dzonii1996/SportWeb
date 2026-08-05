const express = require("express");
const router = express.Router();

const {
  createMatch,
  getMatches,
    deleteMatch,
    updateMatch

} = require("../controllers/matchController");


router.post("/", createMatch);

router.get("/", getMatches);
router.delete("/:id", deleteMatch);
router.put("/:id", updateMatch);


module.exports = router;