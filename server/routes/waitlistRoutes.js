const express = require("express");
const router = express.Router();

const {
  getWaitlist,
  joinWaitlist,
  leaveWaitlist,
} = require("../controllers/waitlistController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:id/waitlist", getWaitlist);
router.post("/:id/waitlist", protect, joinWaitlist);
router.delete("/:id/waitlist", protect, leaveWaitlist);

module.exports = router;
