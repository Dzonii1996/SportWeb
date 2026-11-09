const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { parsePage } = require("../utils/pagination");
const { HttpError } = require("../utils/http");

const getNotifications = async ({ userId: user_id, query = {} }) => {
  const { limit } = parsePage({ limit: query.limit });
  const before = query.before === undefined || query.before === "" ? null : Number(query.before);

  if (before !== null && !Number.isInteger(before)) {
    throw new HttpError(400, msg("common.invalidPage"));
  }

  // Jedna više od tražene, da se zna da li ima još
  const result = await pool.query(
    `
    SELECT
      id,
      message,
      message_key,
      message_params,
      is_read,
      created_at,
      match_id,
      venue_id,
      reservation_id,
      tournament_id
    FROM notifications
    WHERE user_id = $1 AND ($2::int IS NULL OR id < $2)
    ORDER BY id DESC
    LIMIT $3
    `,
    [user_id, before, limit + 1]
  );

  return {
    notifications: result.rows.slice(0, limit),
    has_more: result.rows.length > limit,
  };
};

const getUnreadCount = async ({ userId: user_id }) => {
  const result = await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE user_id = $1
    AND is_read = false
    `,
    [user_id]
  );

  return {
    count: Number(result.rows[0].count),
  };
};

const markAsRead = async ({ id, userId }) => {
  await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    `,
    [id, userId]
  );

  return {
    message: msg("notification.notificationMarkedAsRead"),
  };
};

const markAllAsRead = async ({ userId: user_id }) => {
  await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE user_id = $1
    `,
    [user_id]
  );

  return {
    message: msg("notification.allNotificationsAreRead"),
  };
};

// Kad korisnik otvori stranicu termina, njegove notifikacije za taj termin su viđene
const markMatchAsRead = async ({ match_id, userId }) => {
  await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE user_id = $1
    AND match_id = $2
    AND is_read = false
    `,
    [userId, match_id]
  );

  return {
  };
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markMatchAsRead,
};