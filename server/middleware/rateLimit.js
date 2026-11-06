const rateLimit = require("express-rate-limit");

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

// Ograničenje po IP adresi. U testovima je isključeno, osim gde se baš ono proverava.
// onlyFailed: uspešni zahtevi se ne računaju (prijava sa ispravnom lozinkom).
const limiter = ({ onlyFailed = false } = {}) =>
  rateLimit({
    windowMs: WINDOW_MINUTES * 60 * 1000,
    limit: MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: onlyFailed,
    skip: () => process.env.NODE_ENV === "test" && !process.env.TEST_RATE_LIMIT,
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        message: "Previše pokušaja. Pokušaj ponovo kasnije.",
      }),
  });

module.exports = {
  loginLimiter: limiter({ onlyFailed: true }),
  registerLimiter: limiter(),
  passwordLimiter: limiter(),
  resetLimiter: limiter({ onlyFailed: true }),
};
