import { API_URL } from "../config";
import { authHeader } from "./auth";
import i18n, { locale } from "../i18n";

export const FORMATS = {
  league: { get label() { return i18n.t("tournaments.league"); }, get hint() { return i18n.t("tournaments.everyonePlaysEveryoneTheWinner"); } },
  knockout: { get label() { return i18n.t("tournaments.cup"); }, get hint() { return i18n.t("tournaments.loseAndYoureOutBest"); } },
};

export const STATUS = {
  registration: { get label() { return i18n.t("common.registrationOpen"); }, className: "bg-green-100 text-green-800" },
  in_progress: { get label() { return i18n.t("common.inProgress"); }, className: "bg-amber-100 text-amber-800" },
  finished: { get label() { return i18n.t("tournaments.finished2"); }, className: "bg-gray-200 text-gray-700" },
  cancelled: { get label() { return i18n.t("tournaments.cancelled"); }, className: "bg-red-100 text-red-700" },
};

export const sportIcon = (sport) => (sport === "Košarka" ? "🏀" : "⚽");

// "Finale", "Polufinale", "Četvrtfinale", "1. kolo"
export const roundLabel = (format, round, totalRounds) => {
  if (format === "knockout") {
    const fromEnd = totalRounds - round;

    if (fromEnd === 0) return i18n.t("tournaments.final");
    if (fromEnd === 1) return i18n.t("tournaments.semifinal");
    if (fromEnd === 2) return i18n.t("tournaments.quarterfinal");
  }

  return i18n.t("tournaments.round", { round });
};

// Utakmice po kolima: [{ round, games }]
export const groupByRound = (games) => {
  const rounds = new Map();

  games.forEach((game) => {
    rounds.set(game.round, [...(rounds.get(game.round) || []), game]);
  });

  return [...rounds.entries()].map(([round, list]) => ({ round, games: list }));
};

export const isBye = (game) =>
  game.winner_team_id !== null && (game.team_a_id === null || game.team_b_id === null);

export const formatDate = (date) =>
  new Date(date).toLocaleDateString(locale(), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

// Poziv API-ja za turnire; poruku servera prikazuje korisniku (osim uz silent).
// Vraća true kad je uspelo.
export const tournamentRequest = async (path, { method = "POST", body, silent = false } = {}) => {
  const res = await fetch(`${API_URL}/api/tournaments${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();

  if (!silent || !data.success) alert(data.message);

  return data.success;
};
