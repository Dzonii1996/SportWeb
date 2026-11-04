import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import sr from "./sr.json";
import en from "./en.json";

export const LANGUAGES = [
  { code: "sr", label: "SR", name: "Srpski" },
  { code: "en", label: "EN", name: "English" },
];

const DEFAULT_LANGUAGE = "sr";
const STORAGE_KEY = "lang";

const LOCALES = { sr: "sr-Latn-RS", en: "en-GB" };

// Izbor pamtimo u browseru; bez sačuvanog izbora sajt je na srpskom
const savedLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    return LANGUAGES.some((l) => l.code === saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

i18n.use(initReactI18next).init({
  resources: { sr: { translation: sr }, en: { translation: en } },
  lng: savedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React sam radi escape
});

const syncDocument = (language) => {
  document.documentElement.lang = language;
};

syncDocument(i18n.language);
i18n.on("languageChanged", syncDocument);

export const changeLanguage = (language) => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Bez pristupa localStorage-u izbor važi do osvežavanja
  }

  return i18n.changeLanguage(language);
};

// Oznaka za toLocaleDateString, toLocaleString...
export const locale = () => LOCALES[i18n.language] || LOCALES[DEFAULT_LANGUAGE];

// Sport i podloga se u bazi čuvaju na srpskom, pa se prevode tek pri prikazu
const valueLabel = (group, value) =>
  i18n.t(`${group}.${value}`, { defaultValue: value });

export const sportLabel = (sport) => valueLabel("sports", sport);
export const surfaceLabel = (surface) => valueLabel("surfaces", surface);

export default i18n;
