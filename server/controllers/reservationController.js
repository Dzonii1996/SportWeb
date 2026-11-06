const { route } = require("../utils/http");
const reservations = require("../services/reservationService");

module.exports = {
  updateSettings: route(reservations.updateSettings),
  getAvailability: route(reservations.getAvailability),
  createReservation: route(reservations.createReservation, { status: 201 }),
  getMyReservations: route(reservations.getMyReservations),
  getOwnerReservations: route(reservations.getOwnerReservations),
  confirmReservation: route(reservations.confirmReservation),
  rejectReservation: route(reservations.rejectReservation),
  cancelReservation: route(reservations.cancelReservation),
};
