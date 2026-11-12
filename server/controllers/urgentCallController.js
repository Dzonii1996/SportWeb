const { route } = require("../utils/http");
const urgentCalls = require("../services/urgentCallService");

module.exports = {
  sendUrgentCall: route(urgentCalls.sendUrgentCall),
};
