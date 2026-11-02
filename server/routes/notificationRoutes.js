const express = require("express");

const router = express.Router();

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markMatchAsRead,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

// Sve rute za notifikacije traže prijavu
router.use(protect);

router.get("/:user_id", getNotifications);

router.get(
  "/:user_id/unread",
  getUnreadCount
);

router.put(
  "/match/:match_id/read",
  markMatchAsRead
);

router.put(
  "/read/:id",
  markAsRead
);

router.put(
  "/:user_id/read-all",
  markAllAsRead
);

module.exports = router;