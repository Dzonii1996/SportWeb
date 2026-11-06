const { route } = require("../utils/http");
const reviews = require("../services/venueReviewService");

module.exports = {
  getReviews: route(reviews.getReviews),
  saveReview: route(reviews.saveReview),
  deleteReview: route(reviews.deleteReview),
};
