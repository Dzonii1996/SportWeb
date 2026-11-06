const { route } = require("../utils/http");
const auth = require("../services/authService");

module.exports = {
  register: route(auth.register, { status: 201 }),
  login: route(auth.login),
  forgotPassword: route(auth.forgotPassword),
  resetPassword: route(auth.resetPassword),
};
