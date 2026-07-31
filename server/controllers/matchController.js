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
    users.name
  FROM matches
  JOIN users
    ON users.id = matches.user_id
  ORDER BY match_date, match_time
`);

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

module.exports = {
    createMatch,
    getMatches
};