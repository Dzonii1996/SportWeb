const { route } = require("../utils/http");
const mvp = require("../services/mvpService");

module.exports = {
  getMvp: route(mvp.getMvp),
  voteMvp: route(mvp.voteMvp),
};
