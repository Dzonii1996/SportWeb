const express = require("express");
const router = express.Router();

const { uploadSingle } = require("../middleware/upload");
const { protect, optionalAuth, onlySelf } = require("../middleware/authMiddleware");

const {
  getMyMatches,
  getProfile,
  uploadAvatar,
  updateProfile,
  changePassword,
} = require("../controllers/userController");

router.get("/:user_id/matches", getMyMatches);
router.get("/:id", optionalAuth, getProfile);
router.put("/:id", protect, onlySelf, updateProfile);
router.put("/:id/password", protect, onlySelf, changePassword);

router.post(
  "/:id/avatar",
  protect,
  onlySelf,
  uploadSingle("avatar"),
  uploadAvatar
);

module.exports = router;