const pool = require("../database/db");
const { describeMatch, notifyUsers } = require("../utils/notify");

// Popunjava slobodna mesta igračima sa liste čekanja (po redu upisa)
// i šalje im notifikaciju. Termin se zaključava, kao i pri prijavi,
// da istovremena prijava ne bi prepunila termin.
const promoteFromWaitlist = async (matchId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const match = await client.query(
      `SELECT
         id,
         max_players,
         sport,
         location,
         match_date,
         match_time,
         (match_date + match_time) < NOW() AS is_past
       FROM matches
       WHERE id = $1
       FOR UPDATE`,
      [matchId]
    );

    const matchData = match.rows[0];

    if (!matchData || matchData.is_past) {
      await client.query("ROLLBACK");
      return;
    }

    const players = await client.query(
      `SELECT COUNT(*)
       FROM match_players
       WHERE match_id = $1`,
      [matchId]
    );

    const freeSpots =
      Number(matchData.max_players) - Number(players.rows[0].count);

    if (freeSpots <= 0) {
      await client.query("COMMIT");
      return;
    }

    const next = await client.query(
      `SELECT user_id
       FROM match_waitlist
       WHERE match_id = $1
       ORDER BY created_at, id
       LIMIT $2`,
      [matchId, freeSpots]
    );

    for (const { user_id } of next.rows) {
      await client.query(
        `INSERT INTO match_players(match_id, user_id)
         VALUES($1, $2)
         ON CONFLICT DO NOTHING`,
        [matchId, user_id]
      );

      await client.query(
        `DELETE FROM match_waitlist
         WHERE match_id = $1 AND user_id = $2`,
        [matchId, user_id]
      );

      await notifyUsers(
        client,
        [user_id],
        `Oslobodilo se mesto! Sa liste čekanja ste prijavljeni na termin: ${describeMatch(matchData)}.`,
        matchId
      );
    }

    await client.query("COMMIT");

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  promoteFromWaitlist,
};
