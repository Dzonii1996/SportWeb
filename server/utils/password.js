const { msg } = require("./i18n");
const jwt = require("jsonwebtoken");

const MIN_PASSWORD_LENGTH = 6;

// Isto pravilo za registraciju, promenu i reset lozinke
const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return msg("common.thePasswordMustHaveAt", { n: MIN_PASSWORD_LENGTH });
  }

  if (password.length > 100) {
    return msg("common.thePasswordIsTooLong");
  }

  return null;
};

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

module.exports = {
  validatePassword,
  signToken,
};
