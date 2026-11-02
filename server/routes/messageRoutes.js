const express = require("express");
const router = express.Router();

const {
  getMessages,
  sendMessage,
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const { requireVisible } = require("../utils/privacy");

router.get("/:id/messages", protect, requireVisible, getMessages);
router.post("/:id/messages", protect, sendMessage);

module.exports = router;
