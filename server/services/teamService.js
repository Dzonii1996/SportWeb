const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { describeMatch, notifyUsers } = require("../utils/notify");
const { HIKING } = require("../utils/fields");

const MODES = ["random", "balanced"];

const shuffle = (items) => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

// Raspoređuje igrače u timove A i B.
// random: izmešano pa naizmenično.
// balanced: po oceni saigrača (fer minus nesportski), "zmija" A B B A A B...
// da najbolje ocenjeni ne budu svi u istom timu.
const assignTeams = (players, mode) => {
  if (mode === "random") {
    return shuffle(players).map((p, i) => ({ id: p.id, team: i % 2 === 0 ? "A" : "B" }));
  }

  // Igrači sa istom ocenom se mešaju, da podela ne bude uvek ista
  const sorted = shuffle(players).sort((a, b) => b.score - a.score);

  return sorted.map((p, i) => ({
    id: p.id,
    team: i % 4 === 0 || i % 4 === 3 ? "A" : "B",
  }));
};

const splitTeams = async ({ id, userId, body }) => {
  const client = await pool.connect();

  try {
    const { mode } = body;

    if (!MODES.includes(mode)) {
      throw new HttpError(400, "Nepoznat način podele.");
    }

    await client.query("BEGIN");

    // Zaključavamo termin da se istovremena prijava ne izgubi iz podele
    const match = await client.query(
      "SELECT * FROM matches WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (match.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new HttpError(404, "Termin ne postoji.");
    }

    if (match.rows[0].sport === HIKING) {
      await client.query("ROLLBACK");
      throw new HttpError(400, "Planinarenje nema timove.");
    }

    if (Number(match.rows[0].user_id) !== Number(userId)) {
      await client.query("ROLLBACK");
      throw new HttpError(403, "Samo kreator može da podeli timove.");
    }

    const players = await client.query(
      `SELECT
         mp.user_id AS id,
         COALESCE(SUM(
           CASE r.vote WHEN 'fair' THEN 1 WHEN 'unfair' THEN -1 ELSE 0 END
         ), 0)::int AS score
       FROM match_players mp
       LEFT JOIN match_ratings r ON r.rated_id = mp.user_id
       WHERE mp.match_id = $1
       GROUP BY mp.user_id`,
      [id]
    );

    if (players.rows.length < 2) {
      await client.query("ROLLBACK");
      throw new HttpError(400, "Za podelu su potrebna bar dva igrača.");
    }

    const teams = assignTeams(players.rows, mode);

    for (const { id: userId, team } of teams) {
      await client.query(
        "UPDATE match_players SET team = $3 WHERE match_id = $1 AND user_id = $2",
        [id, userId, team]
      );
    }

    await notifyUsers(
      client,
      teams.map((t) => t.id).filter((u) => Number(u) !== Number(userId)),
      `👕 Timovi su podeljeni za termin: ${describeMatch(match.rows[0])}.`,
      id
    );

    await client.query("COMMIT");

    return {
      teams,
    };

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  splitTeams,
  assignTeams,
};
