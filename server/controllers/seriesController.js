const { route } = require("../utils/http");
const series = require("../services/seriesService");

module.exports = {
  getRegular: route(series.getRegular),
  setRegular: route(series.setRegular),
};
