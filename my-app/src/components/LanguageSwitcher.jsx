import { useTranslation } from "react-i18next";
import { LANGUAGES, changeLanguage } from "../i18n";

// Izbor jezika u navigaciji; aktivni jezik je zelen
function LanguageSwitcher({ className = "inline-flex" }) {
  const { i18n } = useTranslation();

  return (
    <div className={`${className} items-center rounded-full border border-gray-200 p-0.5`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => changeLanguage(l.code)}
          aria-pressed={i18n.language === l.code}
          aria-label={l.name}
          title={l.name}
          className={`px-2 py-1 rounded-full text-xs font-semibold transition ${
            i18n.language === l.code
              ? "bg-green-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
