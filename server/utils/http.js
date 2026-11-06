// Veza između HTTP-a i servisa: servisi ne znaju za req i res. Rezultat vraćaju,
// a kad nešto ne sme bacaju HttpError sa statusom i porukom za korisnika.

class HttpError extends Error {
  // extra su dodatna polja u odgovoru (npr. { expired: true })
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Pravi rutu od funkcije servisa. Servis dobija parametre iz adrese (id, teamId...),
// userId (prijavljeni korisnik, zato ruta ne sme imati parametar :userId), body, query
// i teren i slike iz middleware-a. status je kod uspešnog odgovora,
// a mapError pretvara greške baze u poruku (vraća HttpError ili ništa). Servis može
// da odredi status sam, poljem httpStatus u rezultatu.
// Greška servisa kao JSON odgovor; nepoznate greške se ne pokazuju korisniku
const sendError = (res, error, mapError) => {
  const known = mapError?.(error) || error;

  if (known instanceof HttpError) {
    return res.status(known.status).json({ success: false, message: known.message, ...known.extra });
  }

  console.error(error);

  res.status(500).json({
    success: false,
    message: "Greška servera.",
  });
};

const route = (service, { status = 200, mapError } = {}) => async (req, res) => {
  try {
    const { httpStatus, ...result } = await service({
      ...req.params,
      userId: req.user?.id,
      body: req.body ?? {},
      query: req.query,
      venue: req.venue,
      files: req.files,
      file: req.file,
      language: req.language,
    });

    res.status(httpStatus ?? status).json({ success: true, ...result });

  } catch (error) {
    sendError(res, error, mapError);
  }
};

module.exports = {
  HttpError,
  sendError,
  route,
};
