const { route } = require("../utils/http");
const photos = require("../services/photoService");

module.exports = {
  MAX_UPLOAD: photos.MAX_UPLOAD,
  getTournamentPhotos: route(photos.getTournamentPhotos),
  addTournamentPhotos: route(photos.addTournamentPhotos),
  getMatchPhotos: route(photos.getMatchPhotos),
  addMatchPhotos: route(photos.addMatchPhotos),
  deletePhoto: route(photos.deletePhoto),
  reportPhoto: route(photos.reportPhoto),
  getGallery: route(photos.getGallery),
};
