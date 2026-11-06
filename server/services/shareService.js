const pool = require("../database/db");

// Termin za link za deljenje. Privatni termin bez ispravnog ključa izgleda
// kao da ne postoji. Vraća termin ili null.
const findSharedMatch = async (matchId, key) => {
  const id = Number(matchId);

  if (!Number.isInteger(id)) return null;

  const result = await pool.query(
    `SELECT
       matches.*,
       users.name AS creator_name,
       (SELECT COUNT(*) FROM match_players WHERE match_id = matches.id) AS players
     FROM matches
     JOIN users ON users.id = matches.user_id
     WHERE matches.id = $1`,
    [id]
  );
  const found = result.rows[0];
  const shareKey = typeof key === "string" ? key : null;

  return found && (!found.is_private || (found.share_token && shareKey === found.share_token))
    ? found
    : null;
};

module.exports = {
  findSharedMatch,
};
