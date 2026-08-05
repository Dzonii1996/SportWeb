const pool = require("../database/db");




const createMatch = async (req, res) => {

    
  try {
    const {
  user_id,
  sport,
  location,
  match_date,
  match_time,
  max_players,
} = req.body;

    if (
      !sport ||
      !location ||
      !match_date ||
      !match_time ||
      !max_players
    ) {
      return res.status(400).json({
        success: false,
        message: "Popuni sva polja.",
      });
    }

   const result = await pool.query(
  `INSERT INTO matches
  (user_id, sport, location, match_date, match_time, max_players)
  VALUES ($1,$2,$3,$4,$5,$6)
  RETURNING *`,
  [
    user_id,
    sport,
    location,
    match_date,
    match_time,
    max_players
  ]
);

    res.status(201).json({
      success: true,
      message: "Termin uspešno kreiran.",
      match: result.rows[0],
    });

  }catch (error) {
  console.error("DATABASE ERROR:", error);

  res.status(500).json({
    success: false,
    message: error.message,
  });
}
};

const getMatches = async (req, res) => {
  try {

   const result = await pool.query(`
SELECT
    matches.*,
    users.name AS creator,
    COUNT(match_players.user_id) AS players
FROM matches
LEFT JOIN users
ON users.id = matches.user_id
LEFT JOIN match_players
ON match_players.match_id = matches.id
GROUP BY matches.id, users.name
ORDER BY match_date, match_time
`
);

    res.json({
      success: true,
      matches: result.rows,
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Provera da li termin postoji
    const match = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    // Samo kreator može da obriše
    if (match.rows[0].user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu za brisanje ovog termina.",
      });
    }

    await pool.query(
      "DELETE FROM matches WHERE id = $1",
      [id]
    );

    res.json({
      success: true,
      message: "Termin uspešno obrisan.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      user_id,
      location,
      match_date,
      match_time,
      max_players,
    } = req.body;

    const match = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (match.rows[0].user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Nemate dozvolu.",
      });
    }

    const result = await pool.query(
      `UPDATE matches
       SET
         location = $1,
         match_date = $2,
         match_time = $3,
         max_players = $4
       WHERE id = $5
       RETURNING *`,
      [
        location,
        match_date,
        match_time,
        max_players,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Termin uspešno izmenjen.",
      match: result.rows[0],
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
    createMatch,
    getMatches,
    deleteMatch,
    updateMatch
};