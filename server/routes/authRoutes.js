const express = require("express");
const router = express.Router();

const {
  register,
  login,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const {
  loginLimiter,
  registerLimiter,
  passwordLimiter,
  resetLimiter,
} = require("../middleware/rateLimit");

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", passwordLimiter, forgotPassword);
router.post("/reset-password", resetLimiter, resetPassword);

module.exports = router;