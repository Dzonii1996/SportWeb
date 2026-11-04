const pool = require("../database/db");

const getNotifications = async (req, res) => {
  try {
    const user_id = req.user.id;

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

    res.json({
      success: true,
      notifications: result.rows,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = $1
      AND is_read = false
      `,
      [user_id]
    );

    res.json({
      success: true,
      count: Number(result.rows[0].count),
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      `,
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: "Notifikacija označena kao pročitana.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;

    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1
      `,
      [user_id]
    );

    res.json({
      success: true,
      message: "Sve notifikacije su pročitane.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

// Kad korisnik otvori stranicu termina, njegove notifikacije za taj termin su viđene
const markMatchAsRead = async (req, res) => {
  try {
    const { match_id } = req.params;

    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1
      AND match_id = $2
      AND is_read = false
      `,
      [req.user.id, match_id]
    );

    res.json({
      success: true,
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
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markMatchAsRead,
};