const pool = require("../database/db");

// "Fudbal, Grabovac, 10. 11. 2026. u 18:00"
const describeMatch = (match) => {
  const date = new Date(match.match_date).toLocaleDateString("sr-RS");
  const time = String(match.match_time).slice(0, 5);

  return `${match.sport}, ${match.location}, ${date} u ${time}`;
};

// Šalje istu notifikaciju svim korisnicima iz liste.
// "db" je pool ili client iz transakcije. links.venueId vodi na stranicu terena,
// links.reservationId na stranicu rezervacija, a links.tournamentId na turnir.
const notifyUsers = async (db, userIds, message, matchId = null, links = {}) => {
  const ids = [...new Set(userIds.filter(Boolean).map(Number))];

  if (ids.length === 0) return;

  await db.query(
    `INSERT INTO notifications(user_id, message, match_id, venue_id, reservation_id, tournament_id)
     SELECT unnest($1::int[]), $2, $3, $4, $5, $6`,
    [ids, message, matchId, links.venueId ?? null, links.reservationId ?? null, links.tournamentId ?? null]
  );
};

// Kreator, igrači i (po želji) lista čekanja, bez korisnika koji je izazvao događaj
const matchAudience = async (matchId, { exceptUserId, includeWaitlist = false } = {}) => {
  const result = await pool.query(
    `SELECT user_id FROM matches WHERE id = $1
     UNION
     SELECT user_id FROM match_players WHERE match_id = $1
     ${includeWaitlist ? "UNION SELECT user_id FROM match_waitlist WHERE match_id = $1" : ""}`,
    [matchId]
  );

  return result.rows
    .map((r) => r.user_id)
    .filter((id) => Number(id) !== Number(exceptUserId));
};

module.exports = {
  describeMatch,
  notifyUsers,
  matchAudience,
};
