const { route } = require("../utils/http");
const owners = require("../services/venueOwnerService");

module.exports = {
  claimVenue: route(owners.claimVenue, { status: 201 }),
  getClaims: route(owners.getClaims),
  approveClaim: route(owners.approveClaim),
  rejectClaim: route(owners.rejectClaim),
  removeOwner: route(owners.removeOwner),
  getMyVenues: route(owners.getMyVenues),
};
