const pool = require("../database/db");
const { promoteFromWaitlist } = require("../services/waitlistService");
const {
  describeMatch,
  notifyUsers,
  matchAudience,
} = require("../utils/notify");
const { resetReminders } = require("../utils/reminders");
const { newShareToken } = require("../utils/privacy");
const {
  createSeriesForMatch,
  updateSeriesFromEdit,
} = require("../utils/series");
const {
  ACTIVE: ACTIVE_RESERVATION,
  bookSlot,
  describeSlot,
  reservationStart,
} = require("../services/reservationService");
const { MATCH_SPORTS, SPORT_ACCUSATIVE, parseHike, parsePrice, parseCoords } = require("../utils/fields");

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;
const MAX_DAYS_AHEAD = 365;

// Proverava podatke termina; vraća poruku greške ili null ako je sve u redu
const validateMatch = ({ sport, location, match_date, match_time, max_players }) => {
  if (sport !== undefined && !MATCH_SPORTS.includes(sport)) {
    return "Nepoznat sport.";
  }

  if (typeof location !== "string") {
    return "Neispravna lokacija.";
  }

  const place = location.trim();

  if (place.length < 2 || place.length > 100) {
    return "Lokacija mora imati između 2 i 100 znakova.";
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match_date || "");
  const timeMatch = /^(\d{2}):(\d{2})(:\d{2})?$/.exec(match_time || "");

  if (!dateMatch) {
    return "Neispravan datum.";
  }

  if (!timeMatch) {
    return "Neispravno vreme.";
  }

  const [, y, mo, d] = dateMatch.map(Number);
  const [, h, mi] = timeMatch.map(Number);
  const start = new Date(y, mo - 1, d, h, mi);

  // new Date "popravlja" npr. 31. 2. u 3. 3, pa proveravamo da li je datum stvaran
  if (
    start.getFullYear() !== y ||
    start.getMonth() !== mo - 1 ||
    start.getDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return "Neispravan datum ili vreme.";
  }

  if (start < new Date()) {
    return "Termin ne može biti u prošlosti.";
  }

  const latest = new Date();
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD);

  if (start > latest) {
    return "Termin može biti najviše godinu dana unapred.";
  }

  const playersNum = Number(max_players);

  if (
    !Number.isInteger(playersNum) ||
    playersNum < MIN_PLAYERS ||
    playersNum > MAX_PLAYERS
  ) {
    return `Broj igrača mora biti između ${MIN_PLAYERS} i ${MAX_PLAYERS}.`;
  }

  return null;
};

// Teren iz kataloga za termin. Prazan venue_id znači ručno unetu lokaciju.
// Teren mora biti odobren i za taj sport; currentVenueId (pri izmeni)
// dozvoljava da termin zadrži svoj teren i ako je u međuvremenu skinut sa liste.
// Vraća { error } ili { venue } (null kad teren nije izabran).
const resolveVenue = async (venueId, sport, currentVenueId = null) => {
  if (venueId === undefined || venueId === null || venueId === "") {
    return { venue: null };
  }

  const id = Number(venueId);

  if (!Number.isInteger(id)) {
    return { error: "Neispravan teren." };
  }

  const result = await pool.query("SELECT * FROM venues WHERE id = $1", [id]);
  const venue = result.rows[0];

  if (!venue || (venue.status !== "approved" && id !== Number(currentVenueId))) {
    return { error: "Izabrani teren ne postoji." };
  }

  if (sport && !venue.sports.includes(sport)) {
    return { error: `Teren "${venue.name}" nije za ${SPORT_ACCUSATIVE[sport]}.` };
  }

  return { venue };
};

// Podaci termina sa lokacijom i koordinatama izabranog terena
const withVenue = (body, venue) =>
  venue
    ? {
        ...body,
        location: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
      }
    : body;

// "YYYY-MM-DD" (lokalno) za datum iz baze
const dateKeyOf = (date) => {
  const d = new Date(date);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Postojeća rezervacija za koju se pravi termin: mora biti moja, aktivna
// i još bez termina. Vraća { error } ili { reservation } (null kad nije poslata).
const resolveReservation = async (reservationId, userId) => {
  if (reservationId === undefined || reservationId === null || reservationId === "") {
    return { reservation: null };
  }

  const result = await pool.query(
    `SELECT r.*, (SELECT id FROM matches WHERE reservation_id = r.id) AS match_id
     FROM venue_reservations r
     WHERE r.id = $1 AND r.user_id = $2`,
    [Number(reservationId) || 0, userId]
  );
  const reservation = result.rows[0];

  if (!reservation || !ACTIVE_RESERVATION.includes(reservation.status)) {
    return { error: "Rezervacija ne postoji ili je otkazana." };
  }

  if (reservation.match_id) {
    return { error: "Za ovu rezervaciju je već napravljen termin." };
  }

  return { reservation };
};

const createMatch = async (req, res) => {

    
  try {
    // Termin iz postojeće rezervacije: teren, datum i vreme su sa rezervacije
    const linked = await resolveReservation(req.body.reservation_id, req.user.id);

    if (linked.error) {
      return res.status(400).json({
        success: false,
        message: linked.error,
      });
    }

    const fromReservation = linked.reservation
      ? {
          ...req.body,
          venue_id: linked.reservation.venue_id,
          match_date: dateKeyOf(linked.reservation.reservation_date),
          match_time: `${String(linked.reservation.start_hour).padStart(2, "0")}:00`,
        }
      : req.body;

    // Teren iz kataloga: njegov naziv i koordinate su lokacija termina
    const venue = await resolveVenue(fromReservation.venue_id, req.body.sport);

    if (venue.error) {
      return res.status(400).json({
        success: false,
        message: venue.error,
      });
    }

    const body = withVenue(fromReservation, venue.venue);

    // Nova rezervacija terena uz termin (samo za teren iz kataloga, na pun sat)
    const reserve = !linked.reservation && req.body.reserve === true;

    if (reserve && !venue.venue) {
      return res.status(400).json({
        success: false,
        message: "Izaberi teren sa spiska da bi ga rezervisao.",
      });
    }

    if (reserve && !/^\d{2}:00(:00)?$/.test(body.match_time || "")) {
      return res.status(400).json({
        success: false,
        message: "Za rezervaciju terena termin mora počinjati na pun sat (npr. 19:00).",
      });
    }

    const {
  sport,
  location,
  match_date,
  match_time,
  max_players,
} = body;
    const user_id = req.user.id;

    if (
      !sport ||
      !location ||
      !match_date ||
      !match_time ||
      !max_players
    ) {
      return res.status(400).json({
        success: false,
        message: "Popuni sva polja.",
      });
    }

    const validationError = validateMatch(body);
    const coords = parseCoords(body);

    const price = parsePrice(body);
    const hike = parseHike(body);

    if (validationError || coords.error || price.error || hike.error) {
      return res.status(400).json({
        success: false,
        message: validationError || coords.error || price.error || hike.error,
      });
    }

    const isPrivate = req.body.is_private === true;

    // Termin, rezervacija i (ako se ponavlja) serija se upisuju zajedno ili nijedno
    const client = await pool.connect();
    let match;
    let reservation = linked.reservation;
    let bookingError = null;

    try {
      await client.query("BEGIN");

      if (reserve) {
        const booked = await bookSlot(client, {
          venueId: venue.venue.id,
          userId: user_id,
          date: match_date,
          start: Number(match_time.slice(0, 2)),
          hours: Number(req.body.reservation_hours),
          note: "Za termin na SportWeb-u",
        });

        if (booked.reservation) {
          reservation = booked.reservation;
        } else {
          bookingError = booked;
        }
      }

      if (bookingError) {
        await client.query("ROLLBACK");
      } else {

   const result = await client.query(
  `INSERT INTO matches
  (user_id, sport, location, match_date, match_time, max_players, latitude, longitude, field_price, is_private, share_token, venue_id, reservation_id, hike)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  RETURNING *`,
  [
    user_id,
    sport,
    location.trim(),
    match_date,
    match_time,
    max_players,
    coords.latitude,
    coords.longitude,
    price.price,
    isPrivate,
    isPrivate ? newShareToken() : null,
    venue.venue?.id ?? null,
    reservation?.id ?? null,
    hike.hike
  ]
);
      match = result.rows[0];

      if (req.body.repeat_weekly === true) {
        match.series_id = await createSeriesForMatch(client, match);
      }

      await client.query("COMMIT");
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    // Teren nije mogao da se rezerviše: ni termin nije napravljen
    if (bookingError) {
      return res.status(bookingError.status === 404 ? 400 : bookingError.status).json({
        success: false,
        message: bookingError.message,
      });
    }

    res.status(201).json({
      success: true,
      message:
        reserve && reservation.status === "pending"
          ? "Termin je kreiran. Zahtev za rezervaciju terena je poslat vlasniku."
          : "Termin uspešno kreiran.",
      match: {
        ...match,
        repeat_weekly: Boolean(match.series_id),
        reservation_status: reservation?.status ?? null,
        reservation_start_hour: reservation?.start_hour ?? null,
        reservation_end_hour: reservation?.end_hour ?? null,
      },
    });

  }catch (error) {
  console.error("DATABASE ERROR:", error);

  res.status(500).json({
    success: false,
    message: error.message,
  });
}
};

const getMatches = async (req, res) => {
  try {

   const result = await pool.query(`
SELECT
  matches.*,
  users.name AS creator_name,
  users.avatar AS creator_avatar,
  COUNT(match_players.user_id) AS players,
  COALESCE(match_series.active, false) AS repeat_weekly
FROM matches
JOIN users
  ON users.id = matches.user_id
LEFT JOIN match_players
  ON match_players.match_id = matches.id
LEFT JOIN match_series
  ON match_series.id = matches.series_id
WHERE NOT matches.is_private
GROUP BY matches.id, users.name, users.avatar, match_series.active
ORDER BY match_date`
);

    // Lista je javna: privatni termini nisu u njoj, a ključ se ne šalje
    res.json({
      success: true,
      matches: result.rows.map(({ share_token, ...m }) => m),
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};
const getMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         matches.*,
         users.name AS creator_name,
         users.avatar AS creator_avatar,
         COUNT(match_players.user_id) AS players,
         COALESCE(match_series.active, false) AS repeat_weekly,
         (SELECT name FROM venues WHERE venues.id = matches.venue_id) AS venue_name,
         r.status AS reservation_status,
         r.start_hour AS reservation_start_hour,
         r.end_hour AS reservation_end_hour
       FROM matches
       JOIN users
         ON users.id = matches.user_id
       LEFT JOIN match_players
         ON match_players.match_id = matches.id
       LEFT JOIN match_series
         ON match_series.id = matches.series_id
       LEFT JOIN venue_reservations r
         ON r.id = matches.reservation_id
       WHERE matches.id = $1
       GROUP BY matches.id, users.name, users.avatar, match_series.active,
                r.status, r.start_hour, r.end_hour`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    // Ključ za link šaljemo samo uz privatni termin (ko ga vidi, sme da ga deli)
    const { share_token, ...match } = result.rows[0];

    res.json({
      success: true,
      match: match.is_private ? { ...match, share_token } : match,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Provera da li termin postoji
    const match = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    // Samo kreator može da obriše
    if (match.rows[0].user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu za brisanje ovog termina.",
      });
    }

    // Ko treba da sazna za otkazivanje; posle brisanja prijave više ne postoje
    const audience = await matchAudience(id, {
      exceptUserId: user_id,
      includeWaitlist: true,
    });

    // Rezervacija terena za termin se otkazuje zajedno sa terminom,
    // osim ako je traženo da ostane (?keep_reservation=true)
    const reservationId = match.rows[0].reservation_id;
    let cancelledReservation = null;

    if (reservationId && req.query.keep_reservation !== "true") {
      const reservation = await pool.query(
        `SELECT r.*, v.name AS venue_name, v.owner_id
         FROM venue_reservations r JOIN venues v ON v.id = r.venue_id
         WHERE r.id = $1`,
        [reservationId]
      );
      const r = reservation.rows[0];

      if (r && ACTIVE_RESERVATION.includes(r.status) && reservationStart(r) > new Date()) {
        await pool.query(
          "UPDATE venue_reservations SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
          [r.id]
        );
        cancelledReservation = r;
      }
    }

    await pool.query(
      "DELETE FROM matches WHERE id = $1",
      [id]
    );

    if (cancelledReservation && Number(cancelledReservation.owner_id) !== Number(user_id)) {
      try {
        await notifyUsers(
          pool,
          [cancelledReservation.owner_id],
          `🚫 Rezervacija je otkazana (termin je otkazan): ${cancelledReservation.venue_name}, ${describeSlot(cancelledReservation)}.`,
          null,
          { reservationId: cancelledReservation.id }
        );
      } catch (error) {
        console.error("Greška pri slanju notifikacija:", error);
      }
    }

    try {
      await notifyUsers(
        pool,
        audience,
        `❌ Termin je otkazan: ${describeMatch(match.rows[0])}.`
      );
    } catch (error) {
      console.error("Greška pri slanju notifikacija:", error);
    }

    res.json({
      success: true,
      message: cancelledReservation
        ? "Termin je obrisan, a rezervacija terena otkazana."
        : "Termin uspešno obrisan.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const match = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (match.rows[0].user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu.",
      });
    }

    const venue = await resolveVenue(
      req.body.venue_id,
      match.rows[0].sport,
      match.rows[0].venue_id
    );

    if (venue.error) {
      return res.status(400).json({
        success: false,
        message: venue.error,
      });
    }

    const body = withVenue(req.body, venue.venue);
    const venueId = venue.venue?.id ?? null;

    const {
      location,
      match_date,
      match_time,
      max_players,
    } = body;

    const validationError = validateMatch({
      location,
      match_date,
      match_time,
      max_players,
    });
    const coords = parseCoords(body);

    const price = parsePrice(body);
    const hike = parseHike({ ...body, sport: match.rows[0].sport });

    if (validationError || coords.error || price.error || hike.error) {
      return res.status(400).json({
        success: false,
        message: validationError || coords.error || price.error || hike.error,
      });
    }

    // Termin sa aktivnom rezervacijom: teren, datum i vreme prate rezervaciju
    const old = match.rows[0];

    if (old.reservation_id) {
      const reservation = await pool.query(
        "SELECT status, start_hour, end_hour FROM venue_reservations WHERE id = $1",
        [old.reservation_id]
      );
      const r = reservation.rows[0];
      const changed =
        dateKeyOf(old.match_date) !== match_date ||
        String(old.match_time).slice(0, 5) !== String(match_time).slice(0, 5) ||
        Number(old.venue_id) !== Number(venueId);

      if (r && ACTIVE_RESERVATION.includes(r.status) && changed) {
        return res.status(400).json({
          success: false,
          message: `Termin je vezan za rezervaciju terena (${r.start_hour}–${r.end_hour}h). Da promeniš teren, datum ili vreme, prvo otkaži rezervaciju na stranici Rezervacije.`,
        });
      }
    }

    const playersCount = await pool.query(
      "SELECT COUNT(*) FROM match_players WHERE match_id = $1",
      [id]
    );

    if (Number(max_players) < Number(playersCount.rows[0].count)) {
      return res.status(400).json({
        success: false,
        message: `Na termin je već prijavljeno ${playersCount.rows[0].count} igrača.`,
      });
    }

    // Serija: izmene važe i za sledeće termine; "repeat_weekly" je pokreće ili zaustavlja
    await updateSeriesFromEdit(
      id,
      {
        location: location.trim(),
        match_date,
        match_time,
        max_players,
        latitude: coords.latitude,
        longitude: coords.longitude,
        field_price: price.price,
        is_private: typeof req.body.is_private === "boolean" ? req.body.is_private : undefined,
        venue_id: venueId,
        hike: hike.hike,
      },
      typeof req.body.repeat_weekly === "boolean"
        ? req.body.repeat_weekly
        : undefined
    );

    // Privatnost: kad javni termin postane privatan, pravi se novi ključ,
    // pa linkovi podeljeni dok je bio javan više ne otvaraju termin
    const isPrivate =
      typeof req.body.is_private === "boolean" ? req.body.is_private : old.is_private;
    const shareToken =
      isPrivate && !(old.is_private && old.share_token)
        ? newShareToken()
        : old.share_token;

    const result = await pool.query(
      `UPDATE matches
       SET
         location = $1,
         match_date = $2,
         match_time = $3,
         max_players = $4,
         latitude = $5,
         longitude = $6,
         field_price = $8,
         is_private = $9,
         share_token = $10,
         venue_id = $11,
         hike = $12
       WHERE id = $7
       RETURNING *`,
      [
        location.trim(),
        match_date,
        match_time,
        max_players,
        coords.latitude,
        coords.longitude,
        id,
        price.price,
        isPrivate,
        shareToken,
        venueId,
        hike.hike,
      ]
    );

    // Igrače obaveštavamo samo ako se promenilo mesto ili vreme,
    // a pre popunjavanja sa liste, da novi igrači ne dobiju ovu poruku
    const before = describeMatch(match.rows[0]);
    const after = describeMatch(result.rows[0]);

    if (before !== after) {
      try {
        await resetReminders(id);

        // Novo vreme ili mesto: igrači treba ponovo da potvrde dolazak
        await pool.query(
          "UPDATE match_players SET confirmed_at = NULL WHERE match_id = $1",
          [id]
        );

        const audience = await matchAudience(id, {
          exceptUserId: user_id,
          includeWaitlist: true,
        });

        await notifyUsers(
          pool,
          audience,
          `✏️ Termin je izmenjen: ${after} (ranije: ${before}).`,
          id
        );
      } catch (error) {
        console.error("Greška pri slanju notifikacija:", error);
      }
    }

    // Ako je kreator povećao broj mesta, popunjavamo ih sa liste čekanja
    try {
      await promoteFromWaitlist(id);
    } catch (error) {
      console.error("Greška pri popunjavanju sa liste čekanja:", error);
    }

    res.json({
      success: true,
      message: "Termin uspešno izmenjen.",
      match: result.rows[0],
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
    createMatch,
    getMatches,
    getMatch,
    deleteMatch,
    updateMatch
};