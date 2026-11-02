const pool = require("../database/db");
const { getPlayerStats } = require("./ratingController");

const getMyMatches = async (req, res) => {
  try {
    const { user_id } = req.params;

    const created = await pool.query(`
      SELECT
          matches.*,
          COUNT(match_players.user_id) AS players
      FROM matches
      LEFT JOIN match_players
      ON match_players.match_id = matches.id
      WHERE matches.user_id = $1
      GROUP BY matches.id
      ORDER BY match_date
    `, [user_id]);

    const joined = await pool.query(`
      SELECT
          matches.*,
          COUNT(mp.user_id) AS players
      FROM matches
      JOIN match_players
      ON matches.id = match_players.match_id
      LEFT JOIN match_players mp
      ON mp.match_id = matches.id
      WHERE match_players.user_id = $1
      GROUP BY matches.id
      ORDER BY match_date
    `, [user_id]);

    res.json({
      success: true,
      created: created.rows,
      joined: joined.rows,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await pool.query(
      `
      SELECT id, name, email,avatar
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Korisnik nije pronađen.",
      });
    }

    // Email vidi samo vlasnik profila
    if (Number(req.user?.id) !== Number(id)) {
      delete user.rows[0].email;
    }

    const created = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM matches
      WHERE user_id = $1
      `,
      [id]
    );

    const joined = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM match_players
      WHERE user_id = $1
      `,
      [id]
    );

    res.json({
      success: true,
      user: user.rows[0],
      stats: {
        created: Number(created.rows[0].total),
        joined: Number(joined.rows[0].total),
        ...(await getPlayerStats(id)),
      },
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
  getMyMatches,
  getProfile,
  uploadAvatar

};