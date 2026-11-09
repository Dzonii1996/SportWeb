const { Message, msg, render, fromData, translate, languageOf } = require("../utils/i18n");

const isPlain = (value) =>
  value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

// Notifikacija sa ključem se piše na jeziku čitaoca; starije (samo tekst) po rečniku
const localizeNotification = (n, language) => {
  const { message_key, message_params, ...rest } = n;

  if (!message_key) return { ...rest, message: translate(n.message, language) };

  try {
    return { ...rest, message: render(msg(message_key, fromData(message_params ?? {})), language) };
  } catch {
    // Ključ koji više ne postoji: ostaje tekst sačuvan u trenutku slanja
    return { ...rest, message: translate(n.message, language) };
  }
};

// Napomene rezervacija koje server sam piše (npr. "Termin ... (Fudbal)") su srpski tekst u bazi
const localizeReservation = (r, language) => ({
  ...r,
  note: translate(r.note, language),
  owner_note: translate(r.owner_note, language),
});

// Sve msg(...) poruke u odgovoru postaju tekst na jeziku korisnika
const localize = (value, language) => {
  if (value instanceof Message) return render(value, language);

  if (Array.isArray(value)) return value.map((item) => localize(item, language));

  if (!isPlain(value)) return value;

  const result = {};

  for (const [key, item] of Object.entries(value)) {
    if (key === "notifications" && Array.isArray(item)) {
      result[key] = item.map((n) => localizeNotification(n, language));
    } else if (key === "reservations" && Array.isArray(item)) {
      result[key] = item.map((r) => localize(localizeReservation(r, language), language));
    } else {
      result[key] = localize(item, language);
    }
  }

  return result;
};

// Postavlja req.language iz Accept-Language i piše poruke u JSON odgovorima na tom jeziku.
// Tekst čet poruka i drugi korisnički unos se ne dira (nije Message).
const language = (req, res, next) => {
  req.language = languageOf(req.headers["accept-language"]);

  const json = res.json.bind(res);

  res.json = (body) => {
    const localized = localize(body, req.language);

    // Stari tekst poruke (string) na vrhu odgovora; ugnježdeni "message" je npr. čet
    if (isPlain(localized) && typeof localized.message === "string") {
      localized.message = translate(localized.message, req.language);
    }

    return json(localized);
  };

  next();
};

module.exports = language;
