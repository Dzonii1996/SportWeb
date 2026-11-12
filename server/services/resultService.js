const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { mvpAwardsSql } = require("./mvpService");
const { HttpError } = require("../utils/http");
const { outcome } = require("./playerStatsService");
const { SPORTS, HIKING } = require("../utils/fields");
const { describeMatch, notifyUsers } = require("../utils/notify");

const RESULT_DAYS = 7;
const MAX_SCORE = 999;


const OUTCOME_KEY = {
  W: "common.winTeamATeamB",
  D: "common.drawTeamATeamB",
  L: "common.aLossButNextTime",
};

// Kreator upisuje (ili briše, sa null) rezultat posle termina
const setResult = async ({ id, userId, body }) => {
  const { score_a, score_b } = body;

  const clearing = score_a === null && score_b === null;
  const valid = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;

  if (!clearing && !(valid(score_a) && valid(score_b))) {
    throw new HttpError(400, msg("result.theScoreMustBeA"));
  }

  const match = await pool.query(
    `SELECT
       *,
       (match_date + match_time) < NOW() AS started,
       (match_date + match_time) + INTERVAL '${RESULT_DAYS} days' > NOW() AS open
     FROM matches WHERE id = $1`,
    [id]
  );

  const matchData = match.rows[0];

  if (!matchData) {
    throw new HttpError(404, msg("common.thisGameDoesntExist"));
  }

  if (Number(matchData.user_id) !== Number(userId)) {
    throw new HttpError(403, msg("result.onlyTheCreatorCanEnter"));
  }

  if (matchData.sport === HIKING) {
    throw new HttpError(400, msg("result.hikingHasNoResult"));
  }

  if (!matchData.started) {
    throw new HttpError(400, msg("result.theResultIsEnteredAfter"));
  }

  if (!matchData.open) {
    throw new HttpError(400, msg("result.theResultCanBeEntered", { n: RESULT_DAYS }));
  }

  await pool.query(
    "UPDATE matches SET score_a = $2, score_b = $3 WHERE id = $1",
    [id, score_a, score_b]
  );

  // Svaki igrač dobija rezultat sa svojim ishodom (ako je u timu)
  if (!clearing) {
    const players = await pool.query(
      "SELECT user_id, team FROM match_players WHERE match_id = $1",
      [id]
    );

    const params = { a: score_a, b: score_b, match: describeMatch(matchData) };
    const groups = { W: [], D: [], L: [], none: [] };

    for (const p of players.rows) {
      if (Number(p.user_id) === Number(userId)) continue;
      groups[p.team ? outcome(p.team, score_a, score_b) : "none"].push(p.user_id);
    }

    for (const key of ["W", "D", "L"]) {
      await notifyUsers(
        pool,
        groups[key],
        msg(OUTCOME_KEY[key], params),
        id
      );
    }

    await notifyUsers(
      pool,
      groups.none,
      msg("common.resultEnteredTeamATeam", params),
      id
    );
  }

  return {
    message: clearing ? msg("result.theResultWasDeleted") : msg("common.theResultWasSaved"),
    score_a,
    score_b,
  };
};


// Rang lista: pobeda 3 boda, nerešeno 1. ?sport=Tenis daje listu za jedan sport.
const getLeaderboard = async ({ query }) => {
  const sport = query.sport || null;

  if (sport !== null && !SPORTS.includes(sport)) {
    throw new HttpError(400, msg("common.unknownSport"));
  }

  const result = await pool.query(
    `WITH outcomes AS (
       SELECT
         mp.user_id,
         CASE
           WHEN m.score_a = m.score_b THEN 'D'
           WHEN (mp.team = 'A') = (m.score_a > m.score_b) THEN 'W'
           ELSE 'L'
         END AS result
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.team IS NOT NULL AND m.score_a IS NOT NULL
         AND ($1::text IS NULL OR m.sport = $1)
     )
     SELECT
       users.id,
       users.name,
       users.avatar,
       COUNT(*)::int AS played,
       COUNT(*) FILTER (WHERE result = 'W')::int AS wins,
       COUNT(*) FILTER (WHERE result = 'D')::int AS draws,
       COUNT(*) FILTER (WHERE result = 'L')::int AS losses,
       (3 * COUNT(*) FILTER (WHERE result = 'W')
          + COUNT(*) FILTER (WHERE result = 'D'))::int AS points,
       COALESCE(MAX(mvp.awards), 0)::int AS mvp
     FROM outcomes
     JOIN users ON users.id = outcomes.user_id
     LEFT JOIN (
       SELECT player_id, COUNT(*) AS awards FROM (${mvpAwardsSql("$1")}) a GROUP BY player_id
     ) mvp ON mvp.player_id = users.id
     GROUP BY users.id
     ORDER BY points DESC, wins DESC, played ASC, users.name
     LIMIT 50`,
    [sport]
  );

  return {
    players: result.rows,
  };
};

module.exports = {
  setResult,
  getLeaderboard,
};
