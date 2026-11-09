const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { parsePage, pageInfo } = require("../utils/pagination");
const { promoteFromWaitlist } = require("./waitlistService");
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
} = require("./reservationService");
const { MATCH_SPORTS, SPORT_ACCUSATIVE, parseHike, parsePrice, parseCoords } = require("../utils/fields");

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;
const MAX_DAYS_AHEAD = 365;

// Proverava podatke termina; vraća poruku greške ili null ako je sve u redu
const validateMatch = ({ sport, location, match_date, match_time, max_players }) => {
  if (sport !== undefined && !MATCH_SPORTS.includes(sport)) {
    return msg("common.unknownSport");
  }

  if (typeof location !== "string") {
    return msg("match.invalidLocation");
  }

  const place = location.trim();

  if (place.length < 2 || place.length > 100) {
    return msg("common.locationMustBeBetween2");
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match_date || "");
  const timeMatch = /^(\d{2}):(\d{2})(:\d{2})?$/.exec(match_time || "");

  if (!dateMatch) {
    return msg("common.invalidDate");
  }

  if (!timeMatch) {
    return msg("match.invalidTime");
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
    return msg("common.invalidDateOrTime");
  }

  if (start < new Date()) {
    return msg("match.aGameCantBeIn");
  }

  const latest = new Date();
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD);

  if (start > latest) {
    return msg("match.aGameCanBeAt");
  }

  const playersNum = Number(max_players);

  if (
    !Number.isInteger(playersNum) ||
    playersNum < MIN_PLAYERS ||
    playersNum > MAX_PLAYERS
  ) {
    return msg("match.theNumberOfPlayersMust", { min: MIN_PLAYERS, max: MAX_PLAYERS });
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
    return { error: msg("match.invalidVenue") };
  }

  const result = await pool.query("SELECT * FROM venues WHERE id = $1", [id]);
  const venue = result.rows[0];

  if (!venue || (venue.status !== "approved" && id !== Number(currentVenueId))) {
    return { error: msg("common.theSelectedVenueDoesntExist") };
  }

  if (sport && !venue.sports.includes(sport)) {
    return { error: msg("match.theVenueIsNotFor", { name: venue.name, sport: SPORT_ACCUSATIVE[sport] }) };
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
    return { error: msg("match.theBookingDoesntExistOr") };
  }

  if (reservation.match_id) {
    return { error: msg("match.aGameHasAlreadyBeen") };
  }

  return { reservation };
};

const createMatch = async ({ userId: user_id, body: input }) => {
  // Termin iz postojeće rezervacije: teren, datum i vreme su sa rezervacije
  const linked = await resolveReservation(input.reservation_id, user_id);

  if (linked.error) {
    throw new HttpError(400, linked.error);
  }

  const fromReservation = linked.reservation
    ? {
        ...input,
        venue_id: linked.reservation.venue_id,
        match_date: dateKeyOf(linked.reservation.reservation_date),
        match_time: `${String(linked.reservation.start_hour).padStart(2, "0")}:00`,
      }
    : input;

  // Teren iz kataloga: njegov naziv i koordinate su lokacija termina
  const venue = await resolveVenue(fromReservation.venue_id, input.sport);

  if (venue.error) {
    throw new HttpError(400, venue.error);
  }

  const body = withVenue(fromReservation, venue.venue);

  // Nova rezervacija terena uz termin (samo za teren iz kataloga, na pun sat)
  const reserve = !linked.reservation && input.reserve === true;

  if (reserve && !venue.venue) {
    throw new HttpError(400, msg("match.pickAVenueFromThe"));
  }

  if (reserve && !/^\d{2}:00(:00)?$/.test(body.match_time || "")) {
    throw new HttpError(400, msg("match.toBookAVenueThe"));
  }

  const {
sport,
location,
match_date,
match_time,
max_players,
} = body;

  if (
    !sport ||
    !location ||
    !match_date ||
    !match_time ||
    !max_players
  ) {
    throw new HttpError(400, msg("match.fillInAllTheFields"));
  }

  const validationError = validateMatch(body);
  const coords = parseCoords(body);

  const price = parsePrice(body);
  const hike = parseHike(body);

  if (validationError || coords.error || price.error || hike.error) {
    throw new HttpError(400, validationError || coords.error || price.error || hike.error);
  }

  const isPrivate = input.is_private === true;

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
        hours: Number(input.reservation_hours),
        note: msg("match.forAGameOnSportweb"),
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

    if (input.repeat_weekly === true) {
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
    throw new HttpError(bookingError.status === 404 ? 400 : bookingError.status, bookingError.message);
  }

  return {
    message:
      reserve && reservation.status === "pending"
        ? msg("match.theGameWasCreatedThe")
        : msg("match.gameCreatedSuccessfully"),
    match: {
      ...match,
      repeat_weekly: Boolean(match.series_id),
      reservation_status: reservation?.status ?? null,
      reservation_start_hour: reservation?.start_hour ?? null,
      reservation_end_hour: reservation?.end_hour ?? null,
    },
  };
};

// Pretraga bez obzira na kvačice i velika slova, kao u aplikaciji (đ = dj)
const normalizeSearch = (text) =>
  text
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const NORMALIZED_LOCATION =
  "translate(replace(lower(matches.location), 'đ', 'dj'), 'čćžšáàâäéèêëíìîïóòôöúùûü', 'cczsaaaaeeeeiiiioooouuuu')";

// Udaljenost u km od tačke ($lat, $lng), po haversine formuli
const distanceSql = (lat, lng) => `
  6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(matches.latitude - ${lat}) / 2), 2) +
    COS(RADIANS(${lat})) * COS(RADIANS(matches.latitude)) *
    POWER(SIN(RADIANS(matches.longitude - ${lng}) / 2), 2)
  ))`;

// Javna lista termina, po stranama (?page, ?limit). Filteri: sport, date (YYYY-MM-DD),
// available=true (ima mesta), q (lokacija), past=true (i odigrani),
// lat, lng i radius (km) za "blizu mene", kad su najbliži prvi.
const getMatches = async ({ query = {} }) => {
  const paging = parsePage(query);
  const where = ["NOT matches.is_private"];
  const outer = [];
  const params = [];
  const param = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (query.sport) {
    if (!MATCH_SPORTS.includes(query.sport)) throw new HttpError(400, msg("common.unknownSport"));
    where.push(`matches.sport = ${param(query.sport)}`);
  }

  if (query.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date) || Number.isNaN(Date.parse(query.date))) {
      throw new HttpError(400, msg("common.invalidDate"));
    }
    where.push(`matches.match_date = ${param(query.date)}`);
  }

  if (query.past !== "true") {
    where.push("(matches.match_date + matches.match_time) >= NOW()");
  }

  const q = typeof query.q === "string" ? normalizeSearch(query.q.trim()) : "";

  if (q) {
    where.push(`${NORMALIZED_LOCATION} LIKE ${param(`%${q.replace(/[\\%_]/g, "\\$&")}%`)}`);
  }

  if (query.available === "true") {
    outer.push("players < max_players");
  }

  let distance = "NULL::float";
  const near = query.lat !== undefined || query.lng !== undefined || query.radius !== undefined;

  if (near) {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    const radius = Number(query.radius ?? 10);

    if (
      !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
      !Number.isFinite(radius) || radius <= 0 || radius > 200
    ) {
      throw new HttpError(400, msg("match.invalidLocationForTheNearby"));
    }

    where.push("matches.latitude IS NOT NULL AND matches.longitude IS NOT NULL");
    distance = distanceSql(param(lat), param(lng));
    outer.push(`distance_km <= ${param(radius)}`);
  }

  const limitParam = param(paging.limit);
  const offsetParam = param(paging.offset);
  const sql = `WITH list AS (
       SELECT
         matches.*,
         users.name AS creator_name,
         users.avatar AS creator_avatar,
         (SELECT COUNT(*) FROM match_players WHERE match_players.match_id = matches.id) AS players,
         COALESCE(match_series.active, false) AS repeat_weekly,
         ${distance} AS distance_km
       FROM matches
       JOIN users ON users.id = matches.user_id
       LEFT JOIN match_series ON match_series.id = matches.series_id
       WHERE ${where.join(" AND ")}
     )
     SELECT *, COUNT(*) OVER() AS total_count
     FROM list
     ${outer.length ? `WHERE ${outer.join(" AND ")}` : ""}
     ORDER BY ${near ? "distance_km, " : ""}match_date, match_time, id
     LIMIT ${limitParam} OFFSET ${offsetParam}`;

  const result = await pool.query(sql, params);
  let total = Number(result.rows[0]?.total_count ?? 0);

  // Strana posle poslednje je prazna, pa se ukupan broj čita sa prve
  if (result.rows.length === 0 && paging.offset > 0) {
    const first = await pool.query(sql, params.map((v, i) => (i === params.length - 1 ? 0 : v)));
    total = Number(first.rows[0]?.total_count ?? 0);
  }

  // Lista je javna: privatni termini nisu u njoj, a ključ se ne šalje
  return {
    matches: result.rows.map(({ share_token, total_count, ...match }) => match),
    ...pageInfo(paging, total),
  };
};

// Pregled za početnu stranu: broj predstojećih termina, slobodnih mesta i lokacija,
// broj po sportu, prva tri termina i sledeći termin za svaki sport
const getSummary = async () => {
  const upcoming = `
    SELECT
      matches.*,
      users.name AS creator_name,
      users.avatar AS creator_avatar,
      (SELECT COUNT(*) FROM match_players WHERE match_players.match_id = matches.id) AS players
    FROM matches
    JOIN users ON users.id = matches.user_id
    WHERE NOT matches.is_private AND (matches.match_date + matches.match_time) >= NOW()`;

  const totals = await pool.query(
    `SELECT
       COUNT(*)::int AS games,
       COALESCE(SUM(GREATEST(0, max_players - players)), 0)::int AS free_spots,
       COUNT(DISTINCT LOWER(TRIM(location)))::int AS locations
     FROM (${upcoming}) AS u`
  );
  const bySport = await pool.query(
    `SELECT sport, COUNT(*)::int AS count FROM (${upcoming}) AS u GROUP BY sport`
  );
  const soonest = await pool.query(
    `SELECT * FROM (${upcoming}) AS u ORDER BY match_date, match_time, id LIMIT 3`
  );
  const nextBySport = await pool.query(
    `SELECT DISTINCT ON (sport) * FROM (${upcoming}) AS u ORDER BY sport, match_date, match_time, id`
  );

  const hideKey = ({ share_token, ...match }) => match;

  return {
    ...totals.rows[0],
    by_sport: Object.fromEntries(bySport.rows.map((r) => [r.sport, r.count])),
    upcoming: soonest.rows.map(hideKey),
    next_by_sport: Object.fromEntries(nextBySport.rows.map((r) => [r.sport, hideKey(r)])),
  };
};

const getMatch = async ({ id }) => {
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
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  // Ključ za link šaljemo samo uz privatni termin (ko ga vidi, sme da ga deli)
  const { share_token, ...match } = result.rows[0];

  return {
    match: match.is_private ? { ...match, share_token } : match,
  };
};
const deleteMatch = async ({ id, userId: user_id, query }) => {
  // Provera da li termin postoji
  const match = await pool.query(
    "SELECT * FROM matches WHERE id = $1",
    [id]
  );

  if (match.rows.length === 0) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  // Samo kreator može da obriše
  if (match.rows[0].user_id !== user_id) {
    throw new HttpError(403, msg("match.youDontHavePermissionTo"));
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

  if (reservationId && query.keep_reservation !== "true") {
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
        msg("match.yourBookingWasCancelledThe", { venue: cancelledReservation.venue_name, slot: describeSlot(cancelledReservation) }),
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
      msg("match.gameCancelled", { match: describeMatch(match.rows[0]) })
    );
  } catch (error) {
    console.error("Greška pri slanju notifikacija:", error);
  }

  return {
    message: cancelledReservation
      ? msg("match.theGameWasDeletedAnd")
      : msg("match.gameDeletedSuccessfully"),
  };
};
const updateMatch = async ({ id, userId: user_id, body: input }) => {
  const match = await pool.query(
    "SELECT * FROM matches WHERE id = $1",
    [id]
  );

  if (match.rows.length === 0) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  if (match.rows[0].user_id !== user_id) {
    throw new HttpError(403, msg("common.youDontHavePermission"));
  }

  const venue = await resolveVenue(
    input.venue_id,
    match.rows[0].sport,
    match.rows[0].venue_id
  );

  if (venue.error) {
    throw new HttpError(400, venue.error);
  }

  const body = withVenue(input, venue.venue);
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
    throw new HttpError(400, validationError || coords.error || price.error || hike.error);
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
      throw new HttpError(400, msg("match.thisGameIsTiedTo", { start: r.start_hour, end: r.end_hour }));
    }
  }

  const playersCount = await pool.query(
    "SELECT COUNT(*) FROM match_players WHERE match_id = $1",
    [id]
  );

  if (Number(max_players) < Number(playersCount.rows[0].count)) {
    throw new HttpError(400, msg("match.playersHaveAlreadyJoinedThis", { n: playersCount.rows[0].count }));
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
      is_private: typeof input.is_private === "boolean" ? input.is_private : undefined,
      venue_id: venueId,
      hike: hike.hike,
    },
    typeof input.repeat_weekly === "boolean"
      ? input.repeat_weekly
      : undefined
  );

  // Privatnost: kad javni termin postane privatan, pravi se novi ključ,
  // pa linkovi podeljeni dok je bio javan više ne otvaraju termin
  const isPrivate =
    typeof input.is_private === "boolean" ? input.is_private : old.is_private;
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
        msg("match.gameChangedPreviously", { after, before }),
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

  return {
    message: msg("match.gameUpdatedSuccessfully"),
    match: result.rows[0],
  };
};

module.exports = {
    createMatch,
    getMatches,
  getSummary,
    getMatch,
    deleteMatch,
    updateMatch
};