const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { describeMatch, matchAudience } = require("../utils/notify");

// Da li je korisnik kreator ili prijavljeni igrač termina
const isParticipant = async (match_id, user_id) => {
  const result = await pool.query(
    `SELECT 1
     FROM matches
     WHERE id = $1 AND user_id = $2
     UNION
     SELECT 1
     FROM match_players
     WHERE match_id = $1 AND user_id = $2`,
    [match_id, user_id]
  );

  return result.rows.length > 0;
};

// Čet čitaju učesnici i oni na listi čekanja, a pišu samo učesnici
const canReadChat = async (match_id, user_id) => {
  if (await isParticipant(match_id, user_id)) return true;

  const result = await pool.query(
    "SELECT 1 FROM match_waitlist WHERE match_id = $1 AND user_id = $2",
    [match_id, user_id]
  );

  return result.rows.length > 0;
};

const CHAT_PREFIX = "💬 Nove poruke u četu termina";

// Obaveštava ostale učesnike o novoj poruci. Ko već ima nepročitanu
// notifikaciju za čet ovog termina ne dobija novu, da ne bude spama.
const notifyChat = async (match_id, sender_id) => {
  const match = await pool.query(
    "SELECT * FROM matches WHERE id = $1",
    [match_id]
  );

  if (match.rows.length === 0) return;

  const audience = await matchAudience(match_id, {
    exceptUserId: sender_id,
  });

  if (audience.length === 0) return;

  await pool.query(
    `INSERT INTO notifications(user_id, message, match_id)
     SELECT u, $2, $3
     FROM unnest($1::int[]) AS u
     WHERE NOT EXISTS (
       SELECT 1
       FROM notifications n
       WHERE n.user_id = u
       AND n.match_id = $3
       AND n.is_read = false
       AND n.message LIKE $4
     )`,
    [
      audience,
      `${CHAT_PREFIX}: ${describeMatch(match.rows[0])}.`,
      match_id,
      `${CHAT_PREFIX}%`,
    ]
  );
};

const getMessages = async ({ id, userId, query }) => {
  if (!(await canReadChat(id, userId))) {
    throw new HttpError(403, "Čet vide samo učesnici termina.");
  }

  // Ako je poslat "after", vraćamo samo novije poruke
  const after = Number(query.after) || 0;

  const result = await pool.query(
    `SELECT
       match_messages.id,
       match_messages.message,
       match_messages.created_at,
       users.id AS user_id,
       users.name,
       users.avatar
     FROM match_messages
     JOIN users
       ON users.id = match_messages.user_id
     WHERE match_messages.match_id = $1
     AND match_messages.id > $2
     ORDER BY match_messages.id ASC`,
    [id, after]
  );

  return {
    messages: result.rows,
  };
};

const sendMessage = async ({ id, userId: user_id, body }) => {
  const message = (body.message || "").trim();

  if (!message) {
    throw new HttpError(400, "Poruka ne može biti prazna.");
  }

  if (message.length > 1000) {
    throw new HttpError(400, "Poruka je predugačka.");
  }

  if (!(await isParticipant(id, user_id))) {
    throw new HttpError(403, "Samo učesnici termina mogu da pišu u četu.");
  }

  const result = await pool.query(
    `INSERT INTO match_messages(match_id, user_id, message)
     VALUES($1, $2, $3)
     RETURNING id`,
    [id, user_id, message]
  );

  try {
    await notifyChat(id, user_id);
  } catch (error) {
    console.error("Greška pri slanju notifikacija:", error);
  }

  return {
    id: result.rows[0].id,
  };
};

module.exports = {
  getMessages,
  sendMessage,
};
