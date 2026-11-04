const { translate, languageOf } = require("../utils/i18n");

const localizeNotes = (reservation, language) => ({
  ...reservation,
  note: translate(reservation.note, language),
  owner_note: translate(reservation.owner_note, language),
});

const localizeBody = (body, language) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const localized = { ...body };

  if (typeof body.message === "string") {
    localized.message = translate(body.message, language);
  }

  if (Array.isArray(body.notifications)) {
    localized.notifications = body.notifications.map((n) => ({
      ...n,
      message: translate(n.message, language),
    }));
  }

  if (Array.isArray(body.reservations)) {
    localized.reservations = body.reservations.map((r) => localizeNotes(r, language));
  }

  return localized;
};

// Postavlja req.language iz Accept-Language i prevodi poruke u JSON odgovorima.
// Tekst čet poruka i drugi korisnički unos se ne dira.
const language = (req, res, next) => {
  req.language = languageOf(req.headers["accept-language"]);

  if (req.language !== "sr") {
    const json = res.json.bind(res);

    res.json = (body) => json(localizeBody(body, req.language));
  }

  next();
};

module.exports = language;
