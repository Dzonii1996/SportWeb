const { route } = require("../utils/http");
const invites = require("../services/inviteService");

module.exports = {
  getCandidates: route(invites.getCandidates),
  sendInvites: route(invites.sendInvites),
  getMyInvite: route(invites.getMyInvite),
};
