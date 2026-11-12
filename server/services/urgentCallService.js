const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { describeMatch, notifyUsers } = require("../utils/notify");

// Hitni poziv ima smisla samo kad je termin uskoro
const URGENT_HOURS = 12;
// Igrači sa termina u ovom krugu oko termina (kad termin ima tačku na mapi)
const RADIUS_KM = 15;
// Koliko unazad gledamo ko je igrao
const ACTIVE_DAYS = 90;
const MAX_RECIPIENTS = 50;

// "Fali igrač": kreator javnog termina koji počinje uskoro, a ima slobodnih mesta,
// jednom šalje notifikaciju igračima istog sporta koji su igrali u blizini.
// Blizina je krug od RADIUS_KM, a bez tačke na mapi ista lokacija ili isti teren.
const sendUrgentCall = async ({ id, userId }) => {
  const result = await pool.query(
    `SELECT
       matches.*,
       (match_date + match_time) < NOW() AS is_past,
       (match_date + match_time) > NOW() + make_interval(hours => $2) AS too_early,
       (SELECT COUNT(*) FROM match_players WHERE match_id = matches.id)::int AS players
     FROM matches
     WHERE id = $1`,
    [id, URGENT_HOURS]
  );

  const match = result.rows[0];

  if (!match) throw new HttpError(404, msg("common.thisGameDoesntExist"));

  if (Number(match.user_id) !== Number(userId)) {
    throw new HttpError(403, msg("urgent.onlyTheCreator"));
  }

  if (match.is_past) throw new HttpError(400, msg("common.thisGameHasAlreadyBeen"));
  if (match.is_private) throw new HttpError(400, msg("urgent.notForPrivate"));
  if (match.too_early) throw new HttpError(400, msg("urgent.tooEarly", { hours: URGENT_HOURS }));

  const missing = match.max_players - match.players;

  if (missing <= 0) throw new HttpError(400, msg("urgent.gameIsFull"));
  if (match.urgent_call_at) throw new HttpError(400, msg("urgent.alreadySent"));

  // Bez tačke na mapi ($5 je null) gledaju se samo ista lokacija i isti teren
  const recipients = await pool.query(
    `WITH nearby AS (
       SELECT m.id, m.user_id, (m.match_date + m.match_time) AS starts_at
       FROM matches m
       WHERE m.sport = $2
       AND m.id <> $1
       AND (m.match_date + m.match_time) BETWEEN NOW() - make_interval(days => $3) AND NOW()
       AND (
         lower(m.location) = lower($4)
         OR (m.venue_id IS NOT NULL AND m.venue_id = $8)
         OR ($5::float8 IS NOT NULL AND m.latitude IS NOT NULL AND 6371 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(m.latitude - $5::float8) / 2), 2) +
              COS(RADIANS($5::float8)) * COS(RADIANS(m.latitude)) *
              POWER(SIN(RADIANS(m.longitude - $6::float8) / 2), 2)
            )) <= $7)
       )
     ),
     players AS (
       SELECT mp.user_id, nearby.starts_at FROM match_players mp JOIN nearby ON nearby.id = mp.match_id
       UNION ALL
       SELECT user_id, starts_at FROM nearby
     )
     SELECT players.user_id
     FROM players
     WHERE players.user_id <> $9
     AND NOT EXISTS (SELECT 1 FROM match_players WHERE match_id = $1 AND user_id = players.user_id)
     AND NOT EXISTS (SELECT 1 FROM match_waitlist WHERE match_id = $1 AND user_id = players.user_id)
     GROUP BY players.user_id
     ORDER BY MAX(players.starts_at) DESC
     LIMIT $10`,
    [id, match.sport, ACTIVE_DAYS, match.location, match.latitude, match.longitude, RADIUS_KM, match.venue_id, userId, MAX_RECIPIENTS]
  );

  const ids = recipients.rows.map((r) => r.user_id);

  // Bez primalaca poziv se ne troši, može ponovo kad se pojave igrači
  if (ids.length === 0) {
    return { notified: 0, message: msg("urgent.nobodyNearby") };
  }

  // Samo jedan poziv po terminu, i kad kreator klikne dvaput u isto vreme
  const claimed = await pool.query(
    "UPDATE matches SET urgent_call_at = NOW() WHERE id = $1 AND urgent_call_at IS NULL RETURNING id",
    [id]
  );

  if (claimed.rows.length === 0) throw new HttpError(400, msg("urgent.alreadySent"));

  await notifyUsers(pool, ids, msg("urgent.playersNeeded", { match: describeMatch(match), n: missing }), id);

  return {
    notified: ids.length,
    urgent_call_at: new Date(),
    message: msg("urgent.sent", { n: ids.length }),
  };
};

module.exports = {
  URGENT_HOURS,
  sendUrgentCall,
};
