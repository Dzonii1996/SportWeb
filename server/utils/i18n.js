const en = require("./messages.en");

// Server piše poruke na srpskom, a prevod se primenjuje tek na izlazu,
// po jeziku zahteva. Bez prevoda ostaje srpski tekst.

const PLACEHOLDER = /\{\w+\}/g;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exact = new Map();
const patterns = [];

Object.entries(en).forEach(([sr, target]) => {
  if (!sr.match(PLACEHOLDER)) {
    exact.set(sr, target);
    return;
  }

  const names = sr.match(PLACEHOLDER).map((p) => p.slice(1, -1));
  const source = sr.split(PLACEHOLDER).map(escapeRegex).join("([\\s\\S]+?)");

  patterns.push({
    regex: new RegExp(`^${source}$`),
    names,
    target,
    literal: sr.replace(PLACEHOLDER, "").length,
  });
});

// Najpre najduži tekst, da "…: {slot}. Poruka: {note}" ima prednost nad "…: {slot}."
patterns.sort((a, b) => b.literal - a.literal);

const VALUES = {
  Fudbal: "Football",
  Košarka: "Basketball",
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
const MATCH = new RegExp(`^(Fudbal|Košarka), ([\\s\\S]+), ${DATE} u (\\d{2}:\\d{2})$`);
// "pet, 20. 11. 2026. od 18 do 20h" (describeSlot)
const SLOT = new RegExp(`^(\\S+), ${DATE} od (\\d+) do (\\d+)h$`);

const enDate = (day, month, year) => `${day}/${month}/${year}`;

// Promenljivi deo poruke: sport, datum, opis termina ili rezervacije
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
    const [, weekday, day, month, year, start, end] = slot;

    return `${WEEKDAYS[weekday] || weekday}, ${enDate(day, month, year)} from ${start} to ${end}h`;
  }

  return value;
};

const translate = (text, language) => {
  if (language !== "en" || typeof text !== "string") return text;

  if (exact.has(text)) return exact.get(text);

  for (const { regex, names, target } of patterns) {
    const found = text.match(regex);

    if (found) {
      return target.replace(PLACEHOLDER, (placeholder) =>
        translateValue(found[names.indexOf(placeholder.slice(1, -1)) + 1])
      );
    }
  }

  return text;
};

// "en", "en-GB,en;q=0.9" -> "en"; sve ostalo (i bez zaglavlja) je srpski
const languageOf = (header = "") =>
  header.trim().toLowerCase().startsWith("en") ? "en" : "sr";

module.exports = {
  translate,
  languageOf,
};
