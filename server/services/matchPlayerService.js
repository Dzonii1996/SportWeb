const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { promoteFromWaitlist } = require("./waitlistService");
const { describeMatch, notifyUsers } = require("../utils/notify");

const joinMatch = async ({ id, userId: user_id }) => {
  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    // Zaključavamo termin do kraja transakcije, da dve istovremene
    // prijave ne bi obe prošle proveru za poslednje mesto
    const match = await client.query(
      `SELECT
         matches.id,
         matches.max_players,
         matches.user_id AS creator_id,
         matches.sport,
         (matches.match_date + matches.match_time) < NOW() AS is_past,
         users.name AS creator_name
       FROM matches
       JOIN users
         ON users.id = matches.user_id
       WHERE matches.id = $1
       FOR UPDATE OF matches`,
      [id]
    );

    if (match.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new HttpError(404, msg("common.thisGameDoesntExist"));
    }

    const matchData = match.rows[0];

    if (matchData.is_past) {
      await client.query("ROLLBACK");
      throw new HttpError(400, msg("common.thisGameHasAlreadyBeen"));
    }

    // Provera da li je korisnik već prijavljen
    const exists = await client.query(
      `SELECT 1
       FROM match_players
       WHERE match_id = $1 AND user_id = $2`,
      [id, user_id]
    );

    if (exists.rows.length > 0) {
      await client.query("ROLLBACK");
      throw new HttpError(400, msg("common.youveAlreadyJoinedThisGame"));
    }

    // Broj prijavljenih
    const players = await client.query(
      `SELECT COUNT(*)
       FROM match_players
       WHERE match_id = $1`,
      [id]
    );

    if (
      Number(players.rows[0].count) >=
      Number(matchData.max_players)
    ) {
      await client.query("ROLLBACK");
      throw new HttpError(400, msg("players.thisGameIsFull"));
    }

    // Prijava korisnika
    await client.query(
      `INSERT INTO match_players(match_id, user_id)
       VALUES($1, $2)`,
      [id, user_id]
    );

    // Ako je bio na listi čekanja, više ne treba da bude
    await client.query(
      `DELETE FROM match_waitlist
       WHERE match_id = $1 AND user_id = $2`,
      [id, user_id]
    );

    // Ako korisnik nije sam kreator termina,
    // šaljemo notifikaciju kreatoru
    if (Number(matchData.creator_id) !== Number(user_id)) {
      const player = await client.query(
        `SELECT name
         FROM users
         WHERE id = $1`,
        [user_id]
      );

      const playerName = player.rows[0]?.name || "Korisnik";

      await notifyUsers(
        client,
        [matchData.creator_id],
        msg("players.joinedYourGame", { name: playerName, sport: matchData.sport }),
        id
      );
    }

    await client.query("COMMIT");

    return {
      message: msg("players.youveJoinedTheGame"),
    };

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};
// Kreator dobija obaveštenje kad neko odustane od termina koji tek dolazi
const notifyCreatorAboutLeave = async (match_id, user_id) => {
  const result = await pool.query(
    `SELECT
       matches.*,
       users.name AS player_name,
       (matches.match_date + matches.match_time) < NOW() AS is_past
     FROM matches, users
     WHERE matches.id = $1 AND users.id = $2`,
    [match_id, user_id]
  );

  const match = result.rows[0];

  if (!match || match.is_past || Number(match.user_id) === Number(user_id)) {
    return;
  }

  await notifyUsers(
    pool,
    [match.user_id],
    msg("players.isntComingToYourGame", { name: match.player_name, match: describeMatch(match) }),
    match_id
  );
};

// Igrač potvrđuje da dolazi na termin
const confirmAttendance = async ({ id, userId }) => {
  const result = await pool.query(
    `UPDATE match_players
     SET confirmed_at = COALESCE(confirmed_at, NOW())
     FROM matches
     WHERE match_players.match_id = $1
     AND match_players.user_id = $2
     AND matches.id = match_players.match_id
     AND (matches.match_date + matches.match_time) > NOW()
     RETURNING match_players.confirmed_at`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new HttpError(400, msg("players.youCanOnlyConfirmA"));
  }

  return {
    message: msg("players.greatSeeYouOnThe"),
  };
};

const leaveMatch = async ({ id, userId: user_id }) => {
  const left = await pool.query(
    `DELETE FROM match_players
     WHERE match_id = $1
     AND user_id = $2`,
    [id, user_id]
  );

  // Oslobođeno mesto dobija prvi sa liste čekanja, a kreator saznaje
  // ko ne dolazi. Greške ovde ne poništavaju napuštanje termina.
  if (left.rowCount > 0) {
    try {
      await promoteFromWaitlist(id);
    } catch (error) {
      console.error("Greška pri popunjavanju sa liste čekanja:", error);
    }

    try {
      await notifyCreatorAboutLeave(id, user_id);
    } catch (error) {
      console.error("Greška pri slanju notifikacija:", error);
    }
  }

  return {
    message: msg("players.youveLeftTheGame"),
  };
};
const getMatchPlayers = async ({ id }) => {
  const result = await pool.query(
    `
    SELECT
      users.id,
      users.name
    FROM match_players
    JOIN users
    ON users.id = match_players.user_id
    WHERE match_players.match_id = $1
    `,
    [id]
  );

  return {
    players: result.rows,
  };
};
const getPlayers = async ({ id }) => {
  const result = await pool.query(
    `
    SELECT
      users.id,
      users.name,
      users.avatar,
      match_players.team,
      match_players.paid,
      match_players.confirmed_at IS NOT NULL AS confirmed
    FROM match_players
    JOIN users
    ON users.id = match_players.user_id
    WHERE match_players.match_id = $1
    ORDER BY users.name
    `,
    [id]
  );

  return {
    players: result.rows,
  };
};
const uploadAvatar = async ({ id, file }) => {
  if (!file) {
    throw new HttpError(400, msg("common.noImageSelected"));
  }

  const avatar = `/uploads/${file.filename}`;

  await pool.query(
    "UPDATE users SET avatar = $1 WHERE id = $2",
    [avatar, id]
  );

  return {
    avatar,
  };
};


// Kreator označava da li je igrač platio svoj deo terena
const setPaid = async ({ id, playerId, userId, body }) => {
  const { paid } = body;

  if (typeof paid !== "boolean") {
    throw new HttpError(400, msg("common.invalidRequest"));
  }

  const match = await pool.query(
    "SELECT user_id FROM matches WHERE id = $1",
    [id]
  );

  if (match.rows.length === 0) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  if (Number(match.rows[0].user_id) !== Number(userId)) {
    throw new HttpError(403, msg("players.onlyTheCreatorKeepsTrack"));
  }

  const updated = await pool.query(
    `UPDATE match_players SET paid = $3
     WHERE match_id = $1 AND user_id = $2`,
    [id, playerId, paid]
  );

  if (updated.rowCount === 0) {
    throw new HttpError(400, msg("players.thisUserHasntJoinedThe"));
  }

  return {
    paid,
  };
};

module.exports = {
  joinMatch,
  leaveMatch,
  confirmAttendance,
  setPaid,
    getMatchPlayers,
    getPlayers,
    uploadAvatar

};