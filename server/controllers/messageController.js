const { route } = require("../utils/http");
const messages = require("../services/messageService");

module.exports = {
  getMessages: route(messages.getMessages),
  sendMessage: route(messages.sendMessage, { status: 201 }),
};
