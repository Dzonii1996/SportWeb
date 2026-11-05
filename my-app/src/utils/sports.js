import i18n, { sportLabel } from "../i18n";

// Isti sportovi kao na serveru (utils/fields.js). players je predlog broja igrača.
export const SPORTS = [
  { value: "Fudbal", emoji: "⚽", players: 10 },
  { value: "Košarka", emoji: "🏀", players: 10 },
  { value: "Tenis", emoji: "🎾", players: 2 },
  { value: "Odbojka", emoji: "🏐", players: 12 },
];

const find = (sport) => SPORTS.find((s) => s.value === sport);

export const sportEmoji = (sport) => find(sport)?.emoji ?? "🏅";

export const defaultPlayers = (sport) => find(sport)?.players ?? 10;

// "🎾 Tenis" za izbore i filtere
export const sportOption = (sport) => `${sportEmoji(sport)} ${sportLabel(sport)}`;

// Dugmad za filter po sportu; allValue je vrednost za "Svi"
export const sportFilters = (allValue) => [
  { value: allValue, get label() { return i18n.t("common.all"); } },
  ...SPORTS.map((s) => ({ value: s.value, get label() { return sportOption(s.value); } })),
];
