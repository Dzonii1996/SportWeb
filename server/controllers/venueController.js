const { route, sendError } = require("../utils/http");
const venues = require("../services/venueService");

// Middleware posle protect: teren postoji, a korisnik je admin ili vlasnik.
// Teren stavlja u req.venue.
const requireManager = async (req, res, next) => {
  try {
    req.venue = await venues.findManagedVenue(req.params.id, req.user.id);
    next();

  } catch (error) {
    sendError(res, error);
  }
};

// Middleware pre uploada: fajl se prima tek kad je jasno da korisnik sme
const requireImageEditor = async (req, res, next) => {
  try {
    await venues.requireImageAccess(req.params.id, req.user.id);
    next();

  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  MAX_IMAGES: venues.MAX_IMAGES,
  requireManager,
  requireImageEditor,
  getVenues: route(venues.getVenues),
  getAdminStatus: route(venues.getAdminStatus),
  getAdminList: route(venues.getAdminList),
  getVenue: route(venues.getVenue),
  createVenue: route(venues.createVenue, { status: 201 }),
  updateVenue: route(venues.updateVenue),
  deleteVenue: route(venues.deleteVenue),
  approveVenue: route(venues.approveVenue),
  rejectVenue: route(venues.rejectVenue),
  addImages: route(venues.addImages, { status: 201 }),
  deleteImage: route(venues.deleteImage),
};
