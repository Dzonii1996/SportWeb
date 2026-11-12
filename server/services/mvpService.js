const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const { HttpError } = require("../utils/http");
const { RATING_DAYS, getRatingWindow, getParticipants } = require("./ratingService");

// Najbolji igrač termina postaje onaj sa najviše glasova, ako ima bar MIN_VOTES.
// Kod nerešenog su najbolji svi sa istim brojem glasova.
const MIN_VOTES = 2;

// Najbolji igrači po terminima: (match_id, player_id). $sport ograničava na jedan sport.
const mvpAwardsSql = (sportParam = null) => `
  SELECT counts.match_id, counts.player_id
  FROM (
    SELECT v.match_id, v.player_id, COUNT(*) AS votes,
           MAX(COUNT(*)) OVER (PARTITION BY v.match_id) AS top
    FROM match_mvp_votes v
    ${sportParam ? `JOIN matches mm ON mm.id = v.match_id WHERE (${sportParam}::text IS NULL OR mm.sport = ${sportParam})` : ""}
    GROUP BY v.match_id, v.player_id
  ) counts
  WHERE counts.votes = counts.top AND counts.votes >= ${MIN_VOTES}`;

const loadWindow = async (id) => {
  const window = await getRatingWindow(id);

  if (!window) throw new HttpError(404, msg("common.thisGameDoesntExist"));

  return window;
};

// Glasovi za termin, moj glas i da li mogu da glasam
const getMvp = async ({ id, userId }) => {
  const window = await loadWindow(id);
  const participants = await getParticipants(id);

  const votes = await pool.query(
    `SELECT player_id, COUNT(*)::int AS votes
     FROM match_mvp_votes
     WHERE match_id = $1
     GROUP BY player_id
     ORDER BY votes DESC`,
    [id]
  );

  const mine = await pool.query(
    "SELECT player_id FROM match_mvp_votes WHERE match_id = $1 AND voter_id = $2",
    [id, userId]
  );

  const top = votes.rows[0]?.votes ?? 0;

  return {
    canVote: participants.includes(Number(userId)) && window.started && window.open,
    deadline: window.deadline,
    myVote: mine.rows[0]?.player_id ?? null,
    votes: votes.rows,
    mvp: top >= MIN_VOTES ? votes.rows.filter((r) => r.votes === top).map((r) => r.player_id) : [],
    minVotes: MIN_VOTES,
  };
};

// Daje, menja ili povlači (player_id: null) moj glas
const voteMvp = async ({ id, userId, body }) => {
  const voter = Number(userId);
  const player = body.player_id === null ? null : Number(body.player_id);

  if (player !== null && !Number.isInteger(player)) {
    throw new HttpError(400, msg("common.invalidRequest"));
  }

  if (player === voter) throw new HttpError(400, msg("mvp.cantVoteForYourself"));

  const window = await loadWindow(id);

  if (!window.started) throw new HttpError(400, msg("mvp.onlyAfterTheGame"));
  if (!window.open) throw new HttpError(400, msg("mvp.votingClosed", { n: RATING_DAYS }));

  const participants = await getParticipants(id);

  if (!participants.includes(voter)) throw new HttpError(403, msg("mvp.onlyParticipants"));

  if (player === null) {
    await pool.query("DELETE FROM match_mvp_votes WHERE match_id = $1 AND voter_id = $2", [id, voter]);
  } else {
    if (!participants.includes(player)) throw new HttpError(400, msg("rating.thisUserIsntAParticipant"));

    await pool.query(
      `INSERT INTO match_mvp_votes(match_id, voter_id, player_id)
       VALUES($1, $2, $3)
       ON CONFLICT (match_id, voter_id)
       DO UPDATE SET player_id = EXCLUDED.player_id, created_at = NOW()`,
      [id, voter, player]
    );
  }

  return getMvp({ id, userId });
};

// Koliko puta je igrač bio najbolji
const getMvpCount = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total FROM (${mvpAwardsSql()}) awards WHERE awards.player_id = $1`,
    [userId]
  );

  return result.rows[0].total;
};

module.exports = {
  MIN_VOTES,
  mvpAwardsSql,
  getMvp,
  voteMvp,
  getMvpCount,
};
