const pool = require("../database/db");

const VOTES = ["fair", "unfair", "no_show"];
const RATING_DAYS = 7;

// Termin i da li je u periodu za ocenjivanje (od početka do 7 dana posle)
const getRatingWindow = async (match_id) => {
  const result = await pool.query(
    `SELECT
       user_id AS creator_id,
       (match_date + match_time) < NOW() AS started,
       (match_date + match_time) + INTERVAL '${RATING_DAYS} days' AS deadline,
       (match_date + match_time) + INTERVAL '${RATING_DAYS} days' > NOW() AS open
     FROM matches
     WHERE id = $1`,
    [match_id]
  );

  return result.rows[0];
};

// Učesnici termina: kreator i prijavljeni igrači
const getParticipants = async (match_id) => {
  const result = await pool.query(
    `SELECT user_id FROM matches WHERE id = $1
     UNION
     SELECT user_id FROM match_players WHERE match_id = $1`,
    [match_id]
  );

  return result.rows.map((r) => Number(r.user_id));
};

// Moje ocene za termin i da li trenutno mogu da ocenjujem
const getMyRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = Number(req.user.id);

    const window = await getRatingWindow(id);

    if (!window) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    const participants = await getParticipants(id);

    const votes = await pool.query(
      `SELECT rated_id, vote
       FROM match_ratings
       WHERE match_id = $1 AND rater_id = $2`,
      [id, user_id]
    );

    res.json({
      success: true,
      canRate:
        participants.includes(user_id) && window.started && window.open,
      deadline: window.deadline,
      votes: Object.fromEntries(
        votes.rows.map((r) => [r.rated_id, r.vote])
      ),
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

// Postavlja, menja ili briše (vote: null) moju ocenu za jednog učesnika
const rateParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const rater_id = Number(req.user.id);
    const rated_id = Number(userId);
    const { vote } = req.body;

    if (vote !== null && !VOTES.includes(vote)) {
      return res.status(400).json({
        success: false,
        message: "Nepoznata ocena.",
      });
    }

    if (rater_id === rated_id) {
      return res.status(400).json({
        success: false,
        message: "Ne možete oceniti sebe.",
      });
    }

    const window = await getRatingWindow(id);

    if (!window) {
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (!window.started) {
      return res.status(400).json({
        success: false,
        message: "Ocenjivanje je moguće tek posle termina.",
      });
    }

    if (!window.open) {
      return res.status(400).json({
        success: false,
        message: `Ocenjivanje je moguće ${RATING_DAYS} dana posle termina.`,
      });
    }

    const participants = await getParticipants(id);

    if (!participants.includes(rater_id)) {
      return res.status(403).json({
        success: false,
        message: "Samo učesnici termina mogu da ocenjuju.",
      });
    }

    if (!participants.includes(rated_id)) {
      return res.status(400).json({
        success: false,
        message: "Korisnik nije učesnik ovog termina.",
      });
    }

    if (vote === null) {
      await pool.query(
        `DELETE FROM match_ratings
         WHERE match_id = $1 AND rater_id = $2 AND rated_id = $3`,
        [id, rater_id, rated_id]
      );
    } else {
      await pool.query(
        `INSERT INTO match_ratings(match_id, rater_id, rated_id, vote)
         VALUES($1, $2, $3, $4)
         ON CONFLICT (match_id, rater_id, rated_id)
         DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`,
        [id, rater_id, rated_id, vote]
      );
    }

    res.json({
      success: true,
      vote,
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
  getMyRatings,
  rateParticipant,
};
