const express = require("express");
const router = express.Router();

const {
  getCandidates,
  sendInvites,
  getMyInvite,
} = require("../controllers/inviteController");
const { sendUrgentCall } = require("../controllers/urgentCallController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:id/invite-candidates", protect, getCandidates);
router.post("/:id/invites", protect, sendInvites);
router.get("/:id/my-invite", protect, getMyInvite);
router.post("/:id/urgent-call", protect, sendUrgentCall);

module.exports = router;
