const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { describeMatch, notifyUsers } = require("../utils/notify");

const MAX_INVITES = 30;

// Termin + provera da je korisnik kreator; vraća { match } ili { status, message }
const loadOwnMatch = async (match_id, user_id) => {
  const result = await pool.query(
    `SELECT
       matches.*,
       users.name AS creator_name,
       (match_date + match_time) < NOW() AS is_past
     FROM matches
     JOIN users ON users.id = matches.user_id
     WHERE matches.id = $1`,
    [match_id]
  );

  const match = result.rows[0];

  if (!match) {
    return { status: 404, message: "Termin ne postoji." };
  }

  if (Number(match.user_id) !== Number(user_id)) {
    return { status: 403, message: "Samo kreator poziva igrače." };
  }

  return { match };
};

// Ljudi sa kojima je kreator već bio na nekom terminu (kao igrač ili kreator),
// najčešći saigrači prvi. Već prijavljeni i oni na listi čekanja se preskaču.
const getCandidates = async ({ id, userId }) => {
  const me = userId;

  const { match, status, message } = await loadOwnMatch(id, me);

  if (!match) {
    throw new HttpError(status, message);
  }

  const result = await pool.query(
    `WITH my_matches AS (
       SELECT id AS match_id FROM matches WHERE user_id = $1
       UNION
       SELECT match_id FROM match_players WHERE user_id = $1
     ),
     teammates AS (
       SELECT mp.user_id, mp.match_id
       FROM match_players mp
       JOIN my_matches USING (match_id)
       UNION
       SELECT m.user_id, m.id
       FROM matches m
       JOIN my_matches mm ON mm.match_id = m.id
     )
     SELECT
       users.id,
       users.name,
       users.avatar,
       COUNT(DISTINCT teammates.match_id)::int AS together,
       EXISTS (
         SELECT 1 FROM match_invites
         WHERE match_id = $2 AND user_id = users.id
       ) AS invited
     FROM teammates
     JOIN users ON users.id = teammates.user_id
     WHERE users.id <> $1
     AND NOT EXISTS (
       SELECT 1 FROM match_players WHERE match_id = $2 AND user_id = users.id
     )
     AND NOT EXISTS (
       SELECT 1 FROM match_waitlist WHERE match_id = $2 AND user_id = users.id
     )
     GROUP BY users.id
     ORDER BY together DESC, users.name
     LIMIT 50`,
    [me, id]
  );

  return {
    candidates: result.rows,
  };
};

// Šalje pozive izabranim igračima; svako dobija notifikaciju samo jednom
const sendInvites = async ({ id, userId, body }) => {
  const me = userId;
  const ids = Array.isArray(body.user_ids)
    ? [...new Set(body.user_ids.map(Number))].filter(Number.isInteger)
    : [];

  if (ids.length === 0) {
    throw new HttpError(400, "Izaberi bar jednog igrača.");
  }

  if (ids.length > MAX_INVITES) {
    throw new HttpError(400, `Najviše ${MAX_INVITES} poziva odjednom.`);
  }

  const { match, status, message } = await loadOwnMatch(id, me);

  if (!match) {
    throw new HttpError(status, message);
  }

  if (match.is_past) {
    throw new HttpError(400, "Termin je već odigran.");
  }

  // Samo stvarni korisnici, ne kreator, ne već prijavljeni ili na listi,
  // i samo oni koji još nisu pozvani (RETURNING vraća nove)
  const inserted = await pool.query(
    `INSERT INTO match_invites(match_id, user_id)
     SELECT $1, users.id
     FROM users
     WHERE users.id = ANY($2::int[])
     AND users.id <> $3
     AND NOT EXISTS (SELECT 1 FROM match_players WHERE match_id = $1 AND user_id = users.id)
     AND NOT EXISTS (SELECT 1 FROM match_waitlist WHERE match_id = $1 AND user_id = users.id)
     ON CONFLICT DO NOTHING
     RETURNING user_id`,
    [id, ids, me]
  );

  const invited = inserted.rows.map((r) => r.user_id);

  await notifyUsers(
    pool,
    invited,
    `📩 ${match.creator_name} te poziva na termin: ${describeMatch(match)}. Prijavi se!`,
    id
  );

  return {
    invited: invited.length,
    message:
      invited.length === 0
        ? "Izabrani igrači su već pozvani."
        : `Poslato poziva: ${invited.length}.`,
  };
};

// Da li je trenutni korisnik pozvan na termin (za traku na stranici termina)
const getMyInvite = async ({ id, userId }) => {
  const result = await pool.query(
    `SELECT users.name AS invited_by
     FROM match_invites
     JOIN matches ON matches.id = match_invites.match_id
     JOIN users ON users.id = matches.user_id
     WHERE match_invites.match_id = $1 AND match_invites.user_id = $2`,
    [id, userId]
  );

  return {
    invited: result.rows.length > 0,
    invited_by: result.rows[0]?.invited_by || null,
  };
};

module.exports = {
  getCandidates,
  sendInvites,
  getMyInvite,
};
