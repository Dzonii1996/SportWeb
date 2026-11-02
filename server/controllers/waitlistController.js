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

const getWaitlist = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         users.id,
         users.name,
         users.avatar
       FROM match_waitlist
       JOIN users
         ON users.id = match_waitlist.user_id
       WHERE match_waitlist.match_id = $1
       ORDER BY match_waitlist.created_at, match_waitlist.id`,
      [id]
    );

    res.json({
      success: true,
      waitlist: result.rows,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

const joinWaitlist = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const user_id = req.user.id;

    await client.query("BEGIN");

    // Isto zaključavanje kao pri prijavi, da provera "pun termin" važi
    const match = await client.query(
      `SELECT
         max_players,
         (match_date + match_time) < NOW() AS is_past
       FROM matches
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (match.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    const matchData = match.rows[0];

    if (matchData.is_past) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Termin je već odigran.",
      });
    }

    const players = await client.query(
      `SELECT
         COUNT(*) AS count,
         BOOL_OR(user_id = $2) AS joined
       FROM match_players
       WHERE match_id = $1`,
      [id, user_id]
    );

    if (players.rows[0].joined) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Već ste prijavljeni na ovaj termin.",
      });
    }

    if (Number(players.rows[0].count) < Number(matchData.max_players)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Termin ima slobodnih mesta, prijavite se direktno.",
      });
    }

    const inserted = await client.query(
      `INSERT INTO match_waitlist(match_id, user_id)
       VALUES($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, user_id]
    );

    await client.query("COMMIT");

    if (inserted.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Već ste na listi čekanja.",
      });
    }

    res.json({
      success: true,
      message: "Upisani ste na listu čekanja. Javićemo vam kad se oslobodi mesto.",
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  } finally {
    client.release();
  }
};

const leaveWaitlist = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM match_waitlist
       WHERE match_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: "Izašli ste sa liste čekanja.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

module.exports = {
  promoteFromWaitlist,
  getWaitlist,
  joinWaitlist,
  leaveWaitlist,
};
