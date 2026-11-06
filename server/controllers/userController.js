const { route } = require("../utils/http");
const users = require("../services/userService");

module.exports = {
  getMyMatches: route(users.getMyMatches),
  getProfile: route(users.getProfile),
  uploadAvatar: route(users.uploadAvatar),
  updateProfile: route(users.updateProfile),
  changePassword: route(users.changePassword),
};
