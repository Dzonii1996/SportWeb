const express = require("express");
const router = express.Router();

const {
  getRegular,
  setRegular,
} = require("../controllers/seriesController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:id/regular", protect, getRegular);
router.put("/:id/regular", protect, setRegular);

module.exports = router;
