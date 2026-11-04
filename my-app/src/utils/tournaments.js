import { API_URL } from "../config";
import { authHeader } from "./auth";

export const FORMATS = {
  league: { label: "Liga", hint: "Svako igra sa svakim, pobednik je prvi na tabeli." },
  knockout: { label: "Kup", hint: "Ko izgubi, ispada. Najbolje za 4, 8 ili 16 ekipa." },
};

export const STATUS = {
  registration: { label: "Prijave otvorene", className: "bg-green-100 text-green-800" },
  in_progress: { label: "U toku", className: "bg-amber-100 text-amber-800" },
  finished: { label: "Završen", className: "bg-gray-200 text-gray-700" },
  cancelled: { label: "Otkazan", className: "bg-red-100 text-red-700" },
};

export const sportIcon = (sport) => (sport === "Košarka" ? "🏀" : "⚽");

// "Finale", "Polufinale", "Četvrtfinale", "1. kolo"
export const roundLabel = (format, round, totalRounds) => {
  if (format === "knockout") {
    const fromEnd = totalRounds - round;

    if (fromEnd === 0) return "Finale";
    if (fromEnd === 1) return "Polufinale";
    if (fromEnd === 2) return "Četvrtfinale";
  }

  return `${round}. kolo`;
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
  new Date(date).toLocaleDateString("sr-Latn-RS", {
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
