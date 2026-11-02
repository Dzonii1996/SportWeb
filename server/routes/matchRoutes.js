const express = require("express");
const router = express.Router();

const {
  createMatch,
  getMatches,
    deleteMatch,
    updateMatch,
    

} = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");


router.post("/", protect, createMatch);

router.get("/", getMatches);
router.delete("/:id", protect, deleteMatch);
router.put("/:id", protect, updateMatch);


module.exports = router;