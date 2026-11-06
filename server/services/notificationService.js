const pool = require("../database/db");
const { HttpError } = require("../utils/http");

const getNotifications = async ({ userId: user_id }) => {
  const result = await pool.query(
    `
    SELECT
      id,
      message,
      is_read,
      created_at,
      match_id,
      venue_id,
      reservation_id,
      tournament_id
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [user_id]
  );

  return {
    notifications: result.rows,
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
    message: "Notifikacija označena kao pročitana.",
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
    message: "Sve notifikacije su pročitane.",
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