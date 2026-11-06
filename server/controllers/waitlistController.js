const { route } = require("../utils/http");
const waitlist = require("../services/waitlistService");

module.exports = {
  getWaitlist: route(waitlist.getWaitlist),
  joinWaitlist: route(waitlist.joinWaitlist),
  leaveWaitlist: route(waitlist.leaveWaitlist),
};
