const { route } = require("../utils/http");
const players = require("../services/matchPlayerService");

module.exports = {
  joinMatch: route(players.joinMatch),
  confirmAttendance: route(players.confirmAttendance),
  leaveMatch: route(players.leaveMatch),
  getMatchPlayers: route(players.getMatchPlayers),
  getPlayers: route(players.getPlayers),
  uploadAvatar: route(players.uploadAvatar),
  setPaid: route(players.setPaid),
};
