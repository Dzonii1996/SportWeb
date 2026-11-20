// Svetli / tamni režim. Bez sačuvanog izbora prati podešavanje sistema.
// Isti ključ i ista pravila koristi skripta u public/index.html (pre prvog iscrtavanja).
export const THEME_KEY = "theme";

const THEME_COLORS = { light: "#047857", dark: "#0d1117" };

const media = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export const savedTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);

    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
};

export const systemTheme = () => (media()?.matches ? "dark" : "light");

export const currentTheme = () => savedTheme() || systemTheme();

export const applyTheme = (theme) => {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
};

export const setTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Bez localStorage izbor važi do osvežavanja
  }

  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
};

// Promena sistemskog režima važi dok korisnik nije sam izabrao
export const watchSystemTheme = (onChange) => {
  const mq = media();
  if (!mq) return () => {};

  const handler = () => {
    if (savedTheme()) return;
    applyTheme(systemTheme());
    onChange(systemTheme());
  };

  mq.addEventListener?.("change", handler);

  return () => mq.removeEventListener?.("change", handler);
};
