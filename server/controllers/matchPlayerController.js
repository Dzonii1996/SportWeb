const pool = require("../database/db");

const joinMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Provera da li je korisnik već prijavljen
    const exists = await pool.query(
      `SELECT *
       FROM match_players
       WHERE match_id = $1 AND user_id = $2`,
      [id, user_id]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Već ste prijavljeni na ovaj termin.",
      });
    }

    // Uzimamo podatke o terminu i kreatoru
    const match = await pool.query(
      `SELECT
         matches.id,
         matches.max_players,
         matches.user_id AS creator_id,
         matches.sport,
         users.name AS creator_name
       FROM matches
       JOIN users
         ON users.id = matches.user_id
       WHERE matches.id = $1`,
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    const matchData = match.rows[0];

    // Broj prijavljenih
    const players = await pool.query(
      `SELECT COUNT(*)
       FROM match_players
       WHERE match_id = $1`,
      [id]
    );

    if (
      Number(players.rows[0].count) >=
      Number(matchData.max_players)
    ) {
      return res.status(400).json({
        success: false,
        message: "Termin je popunjen.",
      });
    }

    // Prijava korisnika
    await pool.query(
      `INSERT INTO match_players(match_id, user_id)
       VALUES($1, $2)`,
      [id, user_id]
    );

    // Ako korisnik nije sam kreator termina,
    // šaljemo notifikaciju kreatoru
    if (Number(matchData.creator_id) !== Number(user_id)) {
      const player = await pool.query(
        `SELECT name
         FROM users
         WHERE id = $1`,
        [user_id]
      );

      const playerName = player.rows[0]?.name || "Korisnik";

      await pool.query(
        `INSERT INTO notifications(user_id, message)
         VALUES($1, $2)`,
        [
          matchData.creator_id,
          `${playerName} se prijavio na vaš termin (${matchData.sport}).`,
        ]
      );
    }

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
    const user_id = req.user.id;

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
const uploadAvatar = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Nije izabrana slika.",
      });
    }

    const avatar = `/uploads/${req.file.filename}`;

    await pool.query(
      "UPDATE users SET avatar = $1 WHERE id = $2",
      [avatar, id]
    );

    res.json({
      success: true,
      avatar,
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
    getPlayers,
    uploadAvatar

};