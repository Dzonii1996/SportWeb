const { route } = require("../utils/http");
const matches = require("../services/matchService");

module.exports = {
  createMatch: route(matches.createMatch, { status: 201 }),
  getMatches: route(matches.getMatches),
  getSummary: route(matches.getSummary),
  getMatch: route(matches.getMatch),
  deleteMatch: route(matches.deleteMatch),
  updateMatch: route(matches.updateMatch),
};
