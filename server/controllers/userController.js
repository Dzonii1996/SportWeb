const pool = require("../database/db");
const { getPlayerStats } = require("./ratingController");
const { getResultStats } = require("./resultController");
const bcrypt = require("bcrypt");
const { validatePassword, signToken } = require("../utils/password");

const getMyMatches = async (req, res) => {
  try {
    const { user_id } = req.params;

    const created = await pool.query(`
      SELECT
          matches.*,
          users.name AS creator_name,
          users.avatar AS creator_avatar,
          COALESCE(match_series.active, false) AS repeat_weekly,
          COUNT(match_players.user_id) AS players
      FROM matches
      JOIN users ON users.id = matches.user_id
      LEFT JOIN match_series ON match_series.id = matches.series_id
      LEFT JOIN match_players
      ON match_players.match_id = matches.id
      WHERE matches.user_id = $1
      GROUP BY matches.id, users.name, users.avatar, match_series.active
      ORDER BY match_date
    `, [user_id]);

    const joined = await pool.query(`
      SELECT
          matches.*,
          users.name AS creator_name,
          users.avatar AS creator_avatar,
          COALESCE(match_series.active, false) AS repeat_weekly,
          COUNT(mp.user_id) AS players
      FROM matches
      JOIN users ON users.id = matches.user_id
      LEFT JOIN match_series ON match_series.id = matches.series_id
      JOIN match_players
      ON matches.id = match_players.match_id
      LEFT JOIN match_players mp
      ON mp.match_id = matches.id
      WHERE match_players.user_id = $1
      GROUP BY matches.id, users.name, users.avatar, match_series.active
      ORDER BY match_date
    `, [user_id]);

    // Ruta je javna (po ID-ju korisnika), pa ključ privatnih termina ne šaljemo
    const withoutToken = (rows) => rows.map(({ share_token, ...m }) => m);

    res.json({
      success: true,
      created: withoutToken(created.rows),
      joined: withoutToken(joined.rows),
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
        ...(await getResultStats(id)),
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

// Izmena imena (samo svoj nalog)
const updateProfile = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Ime mora imati između 2 i 100 znakova.",
      });
    }

    const result = await pool.query(
      "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email",
      [name, req.user.id]
    );

    res.json({
      success: true,
      message: "Profil je sačuvan.",
      user: result.rows[0],
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

// Promena lozinke uz trenutnu lozinku. Ostale sesije se odjavljuju,
// a ovaj uređaj dobija novi token da ostane prijavljen.
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const user = await pool.query(
      "SELECT id, email, password FROM users WHERE id = $1",
      [req.user.id]
    );

    const matches =
      typeof currentPassword === "string" &&
      (await bcrypt.compare(currentPassword, user.rows[0].password));

    if (!matches) {
      return res.status(400).json({
        success: false,
        message: "Trenutna lozinka nije tačna.",
      });
    }

    await pool.query(
      `UPDATE users
       SET password = $1, password_changed_at = NOW()
       WHERE id = $2`,
      [await bcrypt.hash(newPassword, 10), req.user.id]
    );

    res.json({
      success: true,
      message: "Lozinka je promenjena. Ostali uređaji su odjavljeni.",
      token: signToken(user.rows[0]),
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
  getMyMatches,
  getProfile,
  uploadAvatar,
  updateProfile,
  changePassword,
};