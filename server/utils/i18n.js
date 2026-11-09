const sr = require("../locales/sr.json");
const en = require("../locales/en.json");

// Poruke servera su ključevi iz locales/sr.json i en.json: msg("match.notFound")
// ili msg("venue.tooManyImages", { n: 6 }). Tekst na jeziku korisnika nastaje
// tek na izlazu (middleware/language.js). Promenljivi delovi (sport, datum,
// opis termina) se pišu na srpskom i prevode pri prikazu.

const CATALOGS = { sr, en };
const PLACEHOLDER = /\{(\w+)\}/g;

const lookup = (catalog, key) =>
  key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), catalog);

class Message {
  constructor(key, params = {}) {
    this.key = key;
    this.params = params;
  }

  // Ako poruka negde završi kao tekst bez jezika, biće na srpskom
  toString() {
    return render(this, "sr");
  }

  toJSON() {
    return this.toString();
  }
}

const msg = (key, params) => {
  if (lookup(sr, key) === undefined) throw new Error(`Nepoznat ključ poruke: ${key}`);

  return new Message(key, params);
};

const isMessage = (value) => value instanceof Message;

// ---------- Promenljivi delovi poruke ----------

const VALUES = {
  Fudbal: "Football",
  Košarka: "Basketball",
  Tenis: "Tennis",
  Odbojka: "Volleyball",
  Planinarenje: "Hiking",
  // "Teren nije za ..." (akuzativ)
  fudbal: "football",
  košarku: "basketball",
  tenis: "tennis",
  odbojku: "volleyball",
  planinarenje: "hiking",
  "Radno vreme": "Opening hours",
  Telefon: "Phone",
  Opis: "Description",
  Razlog: "Reason",
};

const WEEKDAYS = {
  pon: "Mon",
  uto: "Tue",
  sre: "Wed",
  čet: "Thu",
  pet: "Fri",
  sub: "Sat",
  ned: "Sun",
};

const DATE = "(\\d{1,2})\\. ?(\\d{1,2})\\. ?(\\d{4})\\.";

const DATE_ONLY = new RegExp(`^${DATE}$`);
// "Fudbal, Grabovac, 10. 11. 2026. u 18:00" (describeMatch)
const MATCH = new RegExp(`^(Fudbal|Košarka|Tenis|Odbojka|Planinarenje), ([\\s\\S]+), ${DATE} u (\\d{2}:\\d{2})$`);
// "pet, 20. 11. 2026. od 18 do 20h" (describeSlot), po želji sa terenom ispred
const SLOT = new RegExp(`^(?:([\\s\\S]+), )?(pon|uto|sre|čet|pet|sub|ned), ${DATE} od (\\d+) do (\\d+)h$`);

const enDate = (day, month, year) => `${day}/${month}/${year}`;

const translateValue = (value) => {
  if (VALUES[value]) return VALUES[value];

  const date = value.match(DATE_ONLY);

  if (date) return enDate(date[1], date[2], date[3]);

  const match = value.match(MATCH);

  if (match) {
    const [, sport, location, day, month, year, time] = match;

    return `${VALUES[sport]}, ${location}, ${enDate(day, month, year)} at ${time}`;
  }

  const slot = value.match(SLOT);

  if (slot) {
    const [, place, weekday, day, month, year, start, end] = slot;
    const text = `${WEEKDAYS[weekday]}, ${enDate(day, month, year)} from ${start} to ${end}h`;

    return place ? `${place}, ${text}` : text;
  }

  return value;
};

// Poruka na jeziku; parametri mogu biti i same poruke
const render = (message, language = "sr") => {
  if (!isMessage(message)) return translate(message, language);

  const lang = CATALOGS[language] ? language : "sr";
  const template = lookup(CATALOGS[lang], message.key) ?? lookup(sr, message.key) ?? message.key;

  return template.replace(PLACEHOLDER, (placeholder, name) => {
    if (!(name in message.params)) return placeholder;

    const value = message.params[name];

    if (isMessage(value)) return render(value, lang);

    return lang === "sr" ? String(value) : translateValue(String(value));
  });
};

// Poruka za čuvanje u bazi (JSONB) i nazad; ugnježdene poruke su { $key, $params }
const toData = (value) => {
  if (isMessage(value)) return { $key: value.key, $params: toData(value.params) };

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toData(v)]));
  }

  return value;
};

const fromData = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.$key === "string") return msg(value.$key, fromData(value.$params ?? {}));

    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromData(v)]));
  }

  return value;
};

// ---------- Tekst sačuvan ranije (stare notifikacije, napomene u bazi) ----------

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const flatten = (catalog, prefix = "") =>
  Object.entries(catalog).flatMap(([key, value]) =>
    typeof value === "object" ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]
  );

const exact = new Map();
const patterns = [];

flatten(sr).forEach(([key, text]) => {
  const target = lookup(en, key);

  if (!target) return;

  const names = [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);

  if (names.length === 0) {
    exact.set(text, target);
    return;
  }

  patterns.push({
    regex: new RegExp(`^${text.split(/\{\w+\}/).map(escapeRegex).join("([\\s\\S]+?)")}$`),
    names,
    target,
    literal: text.replace(PLACEHOLDER, "").length,
  });
});

// Najpre najduži tekst, da "…: {slot}. Poruka: {note}" ima prednost nad "…: {slot}."
patterns.sort((a, b) => b.literal - a.literal);

// Srpski tekst koji je već sačuvan kao tekst (pre ključeva) prevodi se po rečniku
const translate = (text, language) => {
  if (language !== "en" || typeof text !== "string") return text;

  if (exact.has(text)) return exact.get(text);

  for (const { regex, names, target } of patterns) {
    const found = text.match(regex);

    if (found) {
      return target.replace(PLACEHOLDER, (placeholder, name) =>
        translateValue(found[names.indexOf(name) + 1])
      );
    }
  }

  return text;
};

// "en", "en-GB,en;q=0.9" -> "en"; sve ostalo (i bez zaglavlja) je srpski
const languageOf = (header = "") =>
  header.trim().toLowerCase().startsWith("en") ? "en" : "sr";

module.exports = {
  Message,
  msg,
  isMessage,
  render,
  toData,
  fromData,
  translate,
  languageOf,
};
