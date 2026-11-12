const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");

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
const getMyRatings = async ({ id, userId }) => {
  const user_id = Number(userId);

  const window = await getRatingWindow(id);

  if (!window) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  const participants = await getParticipants(id);

  const votes = await pool.query(
    `SELECT rated_id, vote
     FROM match_ratings
     WHERE match_id = $1 AND rater_id = $2`,
    [id, user_id]
  );

  return {
    canRate:
      participants.includes(user_id) && window.started && window.open,
    deadline: window.deadline,
    votes: Object.fromEntries(
      votes.rows.map((r) => [r.rated_id, r.vote])
    ),
  };
};

// Postavlja, menja ili briše (vote: null) moju ocenu za jednog učesnika
const rateParticipant = async ({ id, playerId, userId, body }) => {
  const rater_id = Number(userId);
  const rated_id = Number(playerId);
  const { vote } = body;

  if (vote !== null && !VOTES.includes(vote)) {
    throw new HttpError(400, msg("rating.unknownRating"));
  }

  if (rater_id === rated_id) {
    throw new HttpError(400, msg("rating.youCantRateYourself"));
  }

  const window = await getRatingWindow(id);

  if (!window) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  if (!window.started) {
    throw new HttpError(400, msg("rating.ratingIsOnlyPossibleAfter"));
  }

  if (!window.open) {
    throw new HttpError(400, msg("rating.ratingIsPossibleForDays", { n: RATING_DAYS }));
  }

  const participants = await getParticipants(id);

  if (!participants.includes(rater_id)) {
    throw new HttpError(403, msg("rating.onlyGameParticipantsCanRate"));
  }

  if (!participants.includes(rated_id)) {
    throw new HttpError(400, msg("rating.thisUserIsntAParticipant"));
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

  return {
    vote,
  };
};


module.exports = {
  RATING_DAYS,
  getRatingWindow,
  getParticipants,
  getMyRatings,
  rateParticipant,
};
