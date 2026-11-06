const { route } = require("../utils/http");
const teams = require("../services/teamService");

module.exports = {
  splitTeams: route(teams.splitTeams),
};
