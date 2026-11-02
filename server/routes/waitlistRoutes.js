const express = require("express");
const router = express.Router();

const {
  getWaitlist,
  joinWaitlist,
  leaveWaitlist,
} = require("../controllers/waitlistController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requireVisible } = require("../utils/privacy");

router.get("/:id/waitlist", optionalAuth, requireVisible, getWaitlist);
router.post("/:id/waitlist", protect, requireVisible, joinWaitlist);
router.delete("/:id/waitlist", protect, leaveWaitlist);

module.exports = router;
