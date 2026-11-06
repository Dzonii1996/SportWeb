// Veza između HTTP-a i servisa: servisi ne znaju za req i res. Rezultat vraćaju,
// a kad nešto ne sme bacaju HttpError sa statusom i porukom za korisnika.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Pravi rutu od funkcije servisa. Servis dobija parametre iz adrese (id, teamId...),
// userId (prijavljeni korisnik, zato ruta ne sme imati parametar :userId), body, query
// i teren iz middleware-a. status je kod uspešnog odgovora,
// a mapError pretvara greške baze u poruku (vraća HttpError ili ništa).
const route = (service, { status = 200, mapError } = {}) => async (req, res) => {
  try {
    const result = await service({
      ...req.params,
      userId: req.user?.id,
      body: req.body ?? {},
      query: req.query,
      venue: req.venue,
    });

    res.status(status).json({ success: true, ...result });

  } catch (error) {
    const known = mapError?.(error) || error;

    if (known instanceof HttpError) {
      return res.status(known.status).json({ success: false, message: known.message });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

module.exports = {
  HttpError,
  route,
};
