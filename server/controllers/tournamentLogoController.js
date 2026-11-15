const { route } = require("../utils/http");
const logo = require("../services/tournamentLogoService");

module.exports = {
  setLogo: route(logo.setLogo),
  removeLogo: route(logo.removeLogo),
};
