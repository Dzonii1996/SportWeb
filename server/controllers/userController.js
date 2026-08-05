const pool = require("../database/db");

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

module.exports = {
  getMyMatches,
};