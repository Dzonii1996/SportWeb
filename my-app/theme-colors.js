// Tamni režim: boje iz Tailwind klasa (bg-white, text-gray-900, bg-green-50...)
// idu kroz CSS promenljive. U svetlom režimu promenljive imaju obične Tailwind
// vrednosti, a pod klasom .dark na <html> dobijaju tamne. Zato komponente ne
// moraju da imaju dark: varijante, a nove stranice automatski dobijaju tamni režim.
const colors = require("tailwindcss/colors");

// Tamne vrednosti po vrsti klase (pozadina, tekst, okvir)
const DARK = {
  bg: {
    white: "#161b22",
    gray: { 50: "#1b2129", 100: "#222932", 200: "#2d353f", 300: "#3a434e", 400: "#4b5563" },
    green: { 50: "#12261b", 100: "#173a26", 200: "#1d4d31" },
    emerald: { 50: "#0f2620", 100: "#133a2e", 200: "#18503e" },
    red: { 50: "#2b1618", 100: "#3d1c1f", 200: "#522226" },
    orange: { 50: "#2b1c12", 100: "#3d2614", 200: "#52321a" },
    amber: { 50: "#2a2112", 100: "#3b2e14", 200: "#4f3c17" },
    yellow: { 50: "#29260f", 100: "#3a3412", 200: "#4d4515" },
    lime: { 50: "#1d2610", 100: "#283a12", 200: "#344d17" },
    blue: { 50: "#121d33", 100: "#172a4a", 200: "#1e3a63" },
    sky: { 50: "#0f2231", 100: "#13314a", 200: "#184263" },
  },
  text: {
    gray: {
      300: "#4a525c", 400: "#6e7781", 500: "#8f98a3", 600: "#aeb6c0",
      700: "#cdd3da", 800: "#e3e7ec", 900: "#f0f3f6",
    },
  },
  border: {
    gray: { 100: "#222932", 200: "#2d353f", 300: "#3a434e" },
    green: { 100: "#1a3a27", 200: "#1f5135", 300: "#276a43" },
    red: { 100: "#3d1c1f", 200: "#5c2328", 300: "#7a2a30" },
    amber: { 100: "#3b2e14", 200: "#5a4214", 300: "#74551a" },
    orange: { 200: "#5c3414", 300: "#7a4418" },
    blue: { 100: "#172a4a", 200: "#1e3f6e", 300: "#25508c" },
    sky: { 200: "#184263" },
    lime: { 200: "#344d17" },
    emerald: { 200: "#18503e" },
  },
};

// Obojeni tekst (zeleni naslovi, crveni natpisi...) na tamnoj pozadini posvetli
const TEXT_HUES = ["green", "emerald", "red", "orange", "amber", "yellow", "lime", "blue", "sky", "stone"];
const TEXT_SHIFT = { 600: 400, 700: 400, 800: 300, 900: 200 };

for (const hue of TEXT_HUES) {
  DARK.text[hue] = {};
  for (const [shade, to] of Object.entries(TEXT_SHIFT)) {
    DARK.text[hue][shade] = colors[hue][to];
  }
}

const channels = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`theme-colors: boja nije u #rrggbb obliku: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
};

const varName = (kind, hue, shade) => `--c-${kind}-${hue}${shade ? `-${shade}` : ""}`;

const light = {};
const dark = {};
const theme = { bg: {}, text: {}, border: {} };

for (const [kind, hues] of Object.entries(DARK)) {
  for (const [hue, value] of Object.entries(hues)) {
    if (typeof value === "string") {
      const name = varName(kind, hue);
      light[name] = channels(colors[hue]);
      dark[name] = channels(value);
      theme[kind][hue] = `rgb(var(${name}) / <alpha-value>)`;
      continue;
    }

    theme[kind][hue] = { ...colors[hue] };
    for (const [shade, hex] of Object.entries(value)) {
      const name = varName(kind, hue, shade);
      light[name] = channels(colors[hue][shade]);
      dark[name] = channels(hex);
      theme[kind][hue][shade] = `rgb(var(${name}) / <alpha-value>)`;
    }
  }
}

// Providna bela (bg-white/10 … /35) stoji na obojenim zaglavljima, pa ostaje bela;
// puna ili skoro puna bela (kartice, bg-white/90 u navigaciji) prati temu.
const whiteBackground = ({ opacityValue }) => {
  const alpha = Number(opacityValue);

  if (!Number.isNaN(alpha) && alpha <= 0.5) return `rgb(255 255 255 / ${opacityValue})`;

  return `rgb(var(${varName("bg", "white")}) / ${opacityValue ?? 1})`;
};

module.exports = {
  lightVars: light,
  darkVars: dark,
  backgroundColor: { ...theme.bg, white: whiteBackground },
  textColor: theme.text,
  borderColor: theme.border,
};
