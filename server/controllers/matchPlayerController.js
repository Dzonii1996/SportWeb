const pool = require("../database/db");

const joinMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Provera da li je korisnik već prijavljen
    const exists = await pool.query(
      `SELECT * FROM match_players
       WHERE match_id = $1 AND user_id = $2`,
      [id, user_id]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Već ste prijavljeni na ovaj termin.",
      });
    }

    // Broj prijavljenih
    const players = await pool.query(
      `SELECT COUNT(*) FROM match_players
       WHERE match_id = $1`,
      [id]
    );

    // Maksimalan broj igrača
    const match = await pool.query(
      `SELECT max_players
       FROM matches
       WHERE id = $1`,
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (
      Number(players.rows[0].count) >=
      match.rows[0].max_players
    ) {
      return res.status(400).json({
        success: false,
        message: "Termin je popunjen.",
      });
    }

    await pool.query(
      `INSERT INTO match_players(match_id, user_id)
       VALUES($1,$2)`,
      [id, user_id]
    );

    res.json({
      success: true,
      message: "Uspešno ste se prijavili.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const leaveMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    await pool.query(
      `DELETE FROM match_players
       WHERE match_id = $1
       AND user_id = $2`,
      [id, user_id]
    );

    res.json({
      success: true,
      message: "Uspešno ste napustili termin.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getMatchPlayers = async (req, res) => {
  try {
    const { id } = req.params;

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

    res.json({
      success: true,
      players: result.rows,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getPlayers = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        users.id,
        users.name,
        users.email
      FROM match_players
      JOIN users
      ON users.id = match_players.user_id
      WHERE match_players.match_id = $1
      ORDER BY users.name
      `,
      [id]
    );

    res.json({
      success: true,
      players: result.rows,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


module.exports = {
  joinMatch,
  leaveMatch,
    getMatchPlayers,
    getPlayers

};