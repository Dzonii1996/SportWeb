import i18n from "../i18n";

export const DIFFICULTIES = ["easy", "medium", "hard"];

export const difficultyLabel = (value) => i18n.t(`hike.${value}`);

export const emptyHike = () => ({
  route: "",
  difficulty: "medium",
  distance_km: "",
  ascent_m: "",
  duration_hours: "",
  gear: "",
});

// Podaci iz baze u polja forme (prazna polja su "", ne null)
export const hikeToForm = (hike) => ({
  ...emptyHike(),
  ...Object.fromEntries(Object.entries(hike || {}).map(([k, v]) => [k, v ?? ""])),
});
