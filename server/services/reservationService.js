const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const withTransaction = require("../database/transaction");
const { HttpError } = require("../utils/http");
const { notifyUsers, matchAudience } = require("../utils/notify");

const MAX_HOURS = 4;
const MAX_DAYS_AHEAD = 60;
const MAX_NOTE = 300;
// Zahtev i potvrđena rezervacija zauzimaju vreme
const ACTIVE = ["pending", "confirmed"];

const notify = async (...args) => {
  try {
    await notifyUsers(pool, ...args);
  } catch (error) {
    console.error("Greška pri slanju notifikacija:", error);
  }
};

// "YYYY-MM-DD" -> [godina, mesec, dan] ili null ako datum ne postoji
const parseDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");

  if (!match) return null;

  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);

  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }

  return [y, m, d];
};

// "pet, 20. 11. 2026. od 18 do 20h"
const describeSlot = (r) => {
  const date = new Date(r.reservation_date).toLocaleDateString("sr-Latn-RS", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return `${date} od ${r.start_hour} do ${r.end_hour}h`;
};

const reservationStart = (r) => {
  const d = new Date(r.reservation_date);

  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), r.start_hour);
};

// Vlasnik podešava da li teren prima rezervacije i u kojim satima.
// Rezervacije mogu da se uključe samo kad teren ima vlasnika (on ih potvrđuje).
const updateSettings = async ({ body, venue }) => {
  const accepts = body.accepts_reservations === true;
  const open = Number(body.reservation_open_hour ?? venue.reservation_open_hour);
  const close = Number(body.reservation_close_hour ?? venue.reservation_close_hour);

  if (
    !Number.isInteger(open) || !Number.isInteger(close) ||
    open < 0 || open > 23 || close < 1 || close > 24 || close <= open
  ) {
    throw new HttpError(400, msg("reservation.invalidBookingHours0To"));
  }

  if (accepts && !venue.owner_id) {
    throw new HttpError(400, msg("reservation.aVenueMustHaveAn"));
  }

  const result = await pool.query(
    `UPDATE venues
     SET accepts_reservations = $2, reservation_open_hour = $3, reservation_close_hour = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, accepts_reservations, reservation_open_hour, reservation_close_hour`,
    [venue.id, accepts, open, close]
  );

  return {
    message: msg("reservation.bookingSettingsSaved"),
    settings: result.rows[0],
  };
};

const findBookableVenue = async (db, id, lock = false) => {
  const result = await db.query(
    `SELECT * FROM venues
     WHERE id = $1 AND status = 'approved' AND accepts_reservations AND owner_id IS NOT NULL
     ${lock ? "FOR UPDATE" : ""}`,
    [Number(id) || 0]
  );

  return result.rows[0] || null;
};

// Zauzeti sati za jedan dan (javno, bez imena onih koji su rezervisali)
const getAvailability = async ({ id, query }) => {
  const venue = await findBookableVenue(pool, id);

  if (!venue) {
    throw new HttpError(404, msg("reservation.thisVenueDoesntTakeBookings"));
  }

  const date = parseDate(query.date);

  if (!date) throw new HttpError(400, msg("common.invalidDate"));

  const result = await pool.query(
    `SELECT start_hour, end_hour, status FROM venue_reservations
     WHERE venue_id = $1 AND reservation_date = $2 AND status = ANY($3)
     ORDER BY start_hour`,
    [venue.id, query.date, ACTIVE]
  );

  return {
    open_hour: venue.reservation_open_hour,
    close_hour: venue.reservation_close_hour,
    price_per_hour: venue.price_per_hour,
    busy: result.rows,
  };
};

// Upisuje rezervaciju u transakciji "client" (pozivalac radi BEGIN/COMMIT).
// Datum "YYYY-MM-DD", početni sat i trajanje u satima (1-4). Vlasnikova rezervacija
// je odmah potvrđena, a za ostale vlasnik dobija notifikaciju.
// Vraća { reservation, byOwner } ili { status, message } kad ne može.
const bookSlot = async (client, { venueId, userId, date: dateKey, start, hours, note = null }) => {
  const date = parseDate(dateKey);

  if (!date) return { status: 400, message: msg("common.invalidDate") };

  if (!Number.isInteger(start) || start < 0 || start > 23) {
    return { status: 400, message: msg("reservation.invalidStartTime") };
  }

  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) {
    return { status: 400, message: msg("reservation.aBookingLastsFrom1", { n: MAX_HOURS }) };
  }

  if (note && note.length > MAX_NOTE) {
    return { status: 400, message: msg("reservation.aNoteCanHaveAt", { n: MAX_NOTE }) };
  }

  const [y, m, d] = date;
  const startsAt = new Date(y, m - 1, d, start);
  const latest = new Date();
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD);

  if (startsAt <= new Date()) {
    return { status: 400, message: msg("reservation.aBookingCantBeIn") };
  }

  if (startsAt > latest) {
    return { status: 400, message: msg("reservation.aBookingCanBeAt", { n: MAX_DAYS_AHEAD }) };
  }

  const end = start + hours;

  // Zaključavamo teren, da dva istovremena zahteva ne dobiju isto vreme
  const venue = await findBookableVenue(client, venueId, true);

  if (!venue) return { status: 404, message: msg("reservation.thisVenueDoesntTakeBookings") };

  if (start < venue.reservation_open_hour || end > venue.reservation_close_hour) {
    return {
      status: 400,
      message: msg("reservation.bookingsArePossibleFromTo", { from: venue.reservation_open_hour, to: venue.reservation_close_hour }),
    };
  }

  const overlap = await client.query(
    `SELECT 1 FROM venue_reservations
     WHERE venue_id = $1 AND reservation_date = $2 AND status = ANY($3)
       AND start_hour < $5 AND end_hour > $4`,
    [venue.id, dateKey, ACTIVE, start, end]
  );

  if (overlap.rows.length > 0) {
    return { status: 409, message: msg("reservation.thatTimeAtTheVenue") };
  }

  const byOwner = Number(venue.owner_id) === Number(userId);

  const inserted = await client.query(
    `INSERT INTO venue_reservations
       (venue_id, user_id, reservation_date, start_hour, end_hour, status, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [venue.id, userId, dateKey, start, end, byOwner ? "confirmed" : "pending", note]
  );
  const reservation = inserted.rows[0];

  if (!byOwner) {
    const user = await client.query("SELECT name FROM users WHERE id = $1", [userId]);

    await notifyUsers(
      client,
      [venue.owner_id],
      msg("reservation.newBookingRequest", { venue: venue.name, slot: describeSlot(reservation), name: user.rows[0].name }),
      null,
      { reservationId: reservation.id }
    );
  }

  return { reservation, byOwner };
};

// Zahtev za rezervaciju sa stranice terena
const createReservation = async ({ id, userId, body }) => {
  const rawNote = body.note;

  const result = await withTransaction((client) =>
    bookSlot(client, {
      venueId: id,
      userId,
      date: body.date,
      start: Number(body.start_hour),
      hours: Number(body.hours),
      note: typeof rawNote === "string" && rawNote.trim() !== "" ? rawNote.trim() : null,
    })
  );

  if (!result.reservation) throw new HttpError(result.status, result.message);

  return {
    message: result.byOwner
      ? msg("reservation.theSlotWasMarkedAs")
      : msg("reservation.requestSentYoullGetA"),
    reservation: result.reservation,
  };
};

const RESERVATION_COLUMNS = `
  r.*,
  v.name AS venue_name,
  v.address AS venue_address,
  v.owner_id,
  v.price_per_hour,
  u.name AS user_name
`;

// Moje rezervacije: predstojeće prve (po vremenu), pa prošle
const getMyReservations = async ({ userId }) => {
  const result = await pool.query(
    `SELECT ${RESERVATION_COLUMNS},
            (SELECT id FROM matches WHERE reservation_id = r.id) AS match_id
     FROM venue_reservations r
     JOIN venues v ON v.id = r.venue_id
     JOIN users u ON u.id = r.user_id
     WHERE r.user_id = $1
     ORDER BY (r.reservation_date + make_interval(hours => r.start_hour)) < NOW(),
              r.reservation_date, r.start_hour`,
    [userId]
  );

  return {
    reservations: result.rows,
  };
};

// Rezervacije na mojim terenima (za vlasnika): predstojeće, uz email onoga ko rezerviše
const getOwnerReservations = async ({ userId }) => {
  const result = await pool.query(
    `SELECT ${RESERVATION_COLUMNS}, u.email AS user_email,
            (SELECT COUNT(*) FROM match_players mp
             JOIN matches m ON m.id = mp.match_id
             WHERE m.reservation_id = r.id)::int AS match_players,
            (SELECT max_players FROM matches WHERE reservation_id = r.id) AS match_max_players
     FROM venue_reservations r
     JOIN venues v ON v.id = r.venue_id
     JOIN users u ON u.id = r.user_id
     WHERE v.owner_id = $1
       AND (r.reservation_date + make_interval(hours => r.end_hour)) >= NOW()
     ORDER BY r.reservation_date, r.start_hour`,
    [userId]
  );

  return {
    reservations: result.rows,
  };
};

const findReservation = async (id) => {
  const result = await pool.query(
    `SELECT r.*, v.name AS venue_name, v.owner_id
     FROM venue_reservations r
     JOIN venues v ON v.id = r.venue_id
     WHERE r.id = $1`,
    [Number(id) || 0]
  );

  return result.rows[0] || null;
};

const notFound = () => new HttpError(404, msg("reservation.theBookingDoesntExist"));

// Kad vlasnik odbije ili otkaže rezervaciju za koju postoji termin, javljamo i
// igračima tog termina (organizator dobija posebnu poruku o rezervaciji)
const notifyMatchPlayers = async (reservation, message) => {
  try {
    const match = await pool.query("SELECT id FROM matches WHERE reservation_id = $1", [
      reservation.id,
    ]);

    if (match.rows.length === 0) return;

    const audience = await matchAudience(match.rows[0].id, {
      exceptUserId: reservation.user_id,
      includeWaitlist: true,
    });

    await notifyUsers(pool, audience, message, match.rows[0].id);
  } catch (error) {
    console.error("Greška pri slanju notifikacija:", error);
  }
};

const forbidden = () => new HttpError(403, msg("common.youDontHavePermission"));

const ownerNote = (body) => {
  const raw = body?.reason;

  return typeof raw === "string" && raw.trim() !== "" ? raw.trim().slice(0, MAX_NOTE) : null;
};

// Vlasnik potvrđuje ili odbija zahtev na čekanju
const decide = (status) => async ({ reservationId, userId, body }) => {
  const reservation = await findReservation(reservationId);

  if (!reservation) throw notFound();

  if (Number(reservation.owner_id) !== Number(userId)) throw forbidden();

  if (reservation.status !== "pending") {
    throw new HttpError(400, msg("reservation.onlyPendingRequestsCanBe"));
  }

  const note = status === "rejected" ? ownerNote(body) : null;

  // Uslov na status sprečava da dve odluke istovremeno prođu
  const result = await pool.query(
    `UPDATE venue_reservations
     SET status = $2, owner_note = $3, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [reservation.id, status, note]
  );

  if (result.rows.length === 0) {
    throw new HttpError(400, msg("reservation.onlyPendingRequestsCanBe"));
  }

  const slot = `${reservation.venue_name}, ${describeSlot(reservation)}`;

  await notify(
    [reservation.user_id],
    status === "confirmed"
      ? msg("reservation.yourBookingWasConfirmed", { slot })
      : note
        ? msg("common.yourBookingWasntAcceptedOwners", { slot, note })
        : msg("common.yourBookingWasntAccepted", { slot }),
    null,
    { reservationId: reservation.id }
  );

  if (status === "rejected") {
    await notifyMatchPlayers(
      reservation,
      msg("reservation.theOwnerDidntAcceptThe", { slot })
    );
  }

  return {
    message: status === "confirmed" ? msg("reservation.theBookingWasConfirmed") : msg("common.theRequestWasRejected"),
    reservation: result.rows[0],
  };
};

// Otkazivanje pre početka: korisnik svoju rezervaciju, vlasnik bilo koju na svom terenu.
// Druga strana dobija obaveštenje.
const cancelReservation = async ({ reservationId, userId, body }) => {
  const reservation = await findReservation(reservationId);

  if (!reservation) throw notFound();

  const isUser = Number(reservation.user_id) === Number(userId);
  const isOwner = Number(reservation.owner_id) === Number(userId);

  if (!isUser && !isOwner) throw forbidden();

  if (!ACTIVE.includes(reservation.status)) {
    throw new HttpError(400, msg("reservation.theBookingWasAlreadyCancelled"));
  }

  if (reservationStart(reservation) <= new Date()) {
    throw new HttpError(400, msg("reservation.theBookingHasAlreadyStarted"));
  }

  const note = isOwner && !isUser ? ownerNote(body) : null;

  const result = await pool.query(
    `UPDATE venue_reservations
     SET status = 'cancelled', owner_note = COALESCE($2, owner_note), updated_at = NOW()
     WHERE id = $1 AND status = ANY($3)
     RETURNING *`,
    [reservation.id, note, ACTIVE]
  );

  if (result.rows.length === 0) {
    throw new HttpError(400, msg("reservation.theBookingWasAlreadyCancelled"));
  }

  const slot = `${reservation.venue_name}, ${describeSlot(reservation)}`;

  if (isUser && !isOwner) {
    await notify(
      [reservation.owner_id],
      msg("reservation.theBookingWasCancelled2", { slot }),
      null,
      { reservationId: reservation.id }
    );
  } else if (!isUser) {
    await notify(
      [reservation.user_id],
      note
        ? msg("common.theOwnerCancelledYourBooking2", { slot, note })
        : msg("common.theOwnerCancelledYourBooking", { slot }),
      null,
      { reservationId: reservation.id }
    );
    await notifyMatchPlayers(
      reservation,
      msg("reservation.theOwnerCancelledTheVenue", { slot })
    );
  }

  return {
    message: msg("reservation.theBookingWasCancelled"),
    reservation: result.rows[0],
  };
};

module.exports = {
  MAX_HOURS,
  ACTIVE,
  bookSlot,
  parseDate,
  describeSlot,
  reservationStart,
  updateSettings,
  getAvailability,
  createReservation,
  getMyReservations,
  getOwnerReservations,
  confirmReservation: decide("confirmed"),
  rejectReservation: decide("rejected"),
  cancelReservation,
};
