const { msg } = require("../utils/i18n");
const { HttpError, route } = require("../utils/http");
const tournaments = require("../services/tournamentService");

// Jedinstveni indeks: naziv ekipe ili igrač koji je već u nekoj ekipi
const mapError = (error) => {
  if (error.code !== "23505") return null;

  return new HttpError(
    400,
    error.constraint === "tournament_teams_name_unique"
      ? msg("tournament.aTeamWithThatName")
      : msg("tournament.youreAlreadyOnATeam")
  );
};

module.exports = {
  createTournament: route(tournaments.createTournament, { status: 201, mapError }),
  updateTournament: route(tournaments.updateTournament, { mapError }),
  getTournaments: route(tournaments.getTournaments, { mapError }),
  getTournament: route(tournaments.getTournament, { mapError }),
  registerTeam: route(tournaments.registerTeam, { status: 201, mapError }),
  getInvite: route(tournaments.getInvite, { mapError }),
  joinTeam: route(tournaments.joinTeam, { mapError }),
  removePlayer: route(tournaments.removePlayer, { mapError }),
  withdrawTeam: route(tournaments.withdrawTeam, { mapError }),
  approveTeam: route(tournaments.approveTeam, { mapError }),
  rejectTeam: route(tournaments.rejectTeam, { mapError }),
  setTeamPaid: route(tournaments.setTeamPaid, { mapError }),
  startTournament: route(tournaments.startTournament, { mapError }),
  saveResult: route(tournaments.saveResult, { mapError }),
  scheduleGame: route(tournaments.scheduleGame, { mapError }),
  cancelTournament: route(tournaments.cancelTournament, { mapError }),
};
