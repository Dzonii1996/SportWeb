const { route } = require("../utils/http");
const results = require("../services/resultService");

module.exports = {
  setResult: route(results.setResult),
  getLeaderboard: route(results.getLeaderboard),
};
