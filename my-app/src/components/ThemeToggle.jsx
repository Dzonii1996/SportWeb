import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { currentTheme, setTheme, watchSystemTheme } from "../utils/theme";

// Prekidač svetlo / tamno u navigaciji; ikonica pokazuje režim u koji se prelazi
function ThemeToggle({ className = "", withLabel = false }) {
  const { t } = useTranslation();
  const [theme, setThemeState] = useState(currentTheme);

  useEffect(() => {
    const onChange = (e) => setThemeState(e.detail);

    window.addEventListener("themechange", onChange);
    const stopWatching = watchSystemTheme(setThemeState);

    return () => {
      window.removeEventListener("themechange", onChange);
      stopWatching();
    };
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`items-center gap-2 rounded-full transition text-gray-600 hover:text-gray-900 hover:bg-gray-100 ${
        withLabel ? "px-3 py-1.5 border border-gray-200 text-sm font-semibold" : "p-2"
      } ${className}`}
    >
      {isDark ? <Sun size={withLabel ? 16 : 20} /> : <Moon size={withLabel ? 16 : 20} />}
      {withLabel && <span>{isDark ? t("theme.light") : t("theme.dark")}</span>}
    </button>
  );
}

export default ThemeToggle;
