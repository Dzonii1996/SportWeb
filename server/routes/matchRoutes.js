const express = require("express");
const router = express.Router();

const {
  createMatch,
  getMatches,
  getMatch,
    deleteMatch,
    updateMatch,
    

} = require("../controllers/matchController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requireVisible } = require("../utils/privacy");


router.post("/", protect, createMatch);

router.get("/", getMatches);
router.get("/:id", optionalAuth, requireVisible, getMatch);
router.delete("/:id", protect, deleteMatch);
router.put("/:id", protect, updateMatch);


module.exports = router;