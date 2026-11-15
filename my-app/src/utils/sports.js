import i18n, { sportLabel } from "../i18n";

// Isti sportovi kao na serveru (utils/fields.js). players je predlog broja igrača.
// Sportovi sa terenima, turnirima i rang listom:
export const SPORTS = [
  { value: "Fudbal", emoji: "⚽", players: 10 },
  { value: "Košarka", emoji: "🏀", players: 10 },
  { value: "Tenis", emoji: "🎾", players: 2 },
  { value: "Odbojka", emoji: "🏐", players: 12 },
];

// Planinarenje postoji samo kao termin: bez terena, timova i rezultata
export const HIKING = "Planinarenje";

export const MATCH_SPORTS = [...SPORTS, { value: HIKING, emoji: "🥾", players: 10 }];

const find = (sport) => MATCH_SPORTS.find((s) => s.value === sport);

export const sportEmoji = (sport) => find(sport)?.emoji ?? "🏅";

// Boje kartice termina po sportu (pune klase, da ih Tailwind pronađe)
const SPORT_COLORS = {
  Fudbal: { header: "from-green-600 to-emerald-500", text: "text-green-700", icon: "text-green-600", button: "bg-green-600 hover:bg-green-700" },
  Košarka: { header: "from-orange-600 to-amber-500", text: "text-orange-700", icon: "text-orange-600", button: "bg-orange-600 hover:bg-orange-700" },
  Tenis: { header: "from-lime-600 to-lime-500", text: "text-lime-700", icon: "text-lime-600", button: "bg-lime-600 hover:bg-lime-700" },
  Odbojka: { header: "from-blue-600 to-sky-500", text: "text-blue-700", icon: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
  Planinarenje: { header: "from-stone-600 to-amber-700", text: "text-stone-700", icon: "text-stone-600", button: "bg-stone-600 hover:bg-stone-700" },
};

export const sportColors = (sport) => SPORT_COLORS[sport] ?? SPORT_COLORS.Fudbal;

export const defaultPlayers = (sport) => find(sport)?.players ?? 10;

// "🎾 Tenis" za izbore i filtere
export const sportOption = (sport) => `${sportEmoji(sport)} ${sportLabel(sport)}`;

// Dugmad za filter po sportu; allValue je vrednost za "Svi"
export const sportFilters = (allValue, sports = SPORTS) => [
  { value: allValue, get label() { return i18n.t("common.all"); } },
  ...sports.map((s) => ({ value: s.value, get label() { return sportOption(s.value); } })),
];
