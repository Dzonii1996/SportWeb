const { route } = require("../utils/http");
const ratings = require("../services/ratingService");

module.exports = {
  getMyRatings: route(ratings.getMyRatings),
  rateParticipant: route(ratings.rateParticipant),
};
