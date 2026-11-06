const pool = require("../database/db");

// Ishod za tim: 'W' pobeda, 'D' nerešeno, 'L' poraz
const outcome = (team, scoreA, scoreB) => {
  if (scoreA === scoreB) return "D";

  const won = team === "A" ? scoreA > scoreB : scoreB > scoreA;

  return won ? "W" : "L";
};

// Pobede/nerešeno/porazi igrača, iz termina sa rezultatom u kojima je bio u timu
const getResultStats = async (user_id) => {
  const result = await pool.query(
    `SELECT mp.team, m.score_a, m.score_b
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = $1
     AND mp.team IS NOT NULL
     AND m.score_a IS NOT NULL
     ORDER BY (m.match_date + m.match_time) DESC`,
    [user_id]
  );

  const outcomes = result.rows.map((r) => outcome(r.team, r.score_a, r.score_b));
  const count = (o) => outcomes.filter((x) => x === o).length;

  // Niz pobeda zaredom, od poslednjeg termina unazad
  let streak = 0;
  while (outcomes[streak] === "W") streak += 1;

  const wins = count("W");

  return {
    wins,
    draws: count("D"),
    losses: count("L"),
    winRate: outcomes.length ? Math.round((wins / outcomes.length) * 100) : null,
    streak,
    // Poslednjih 5 ishoda, najnoviji prvi
    form: outcomes.slice(0, 5),
  };
};

// Statistika za profil: odigrani termini, fer plej i nedolasci
const getPlayerStats = async (user_id) => {
  const result = await pool.query(
    `SELECT
       (
         SELECT COUNT(*)
         FROM matches m
         WHERE (m.match_date + m.match_time) < NOW()
         AND (
           m.user_id = $1
           OR EXISTS (
             SELECT 1 FROM match_players mp
             WHERE mp.match_id = m.id AND mp.user_id = $1
           )
         )
       ) AS played,
       (
         SELECT COUNT(*) FROM match_ratings
         WHERE rated_id = $1 AND vote = 'fair'
       ) AS fair,
       (
         SELECT COUNT(*) FROM match_ratings
         WHERE rated_id = $1 AND vote = 'unfair'
       ) AS unfair,
       (
         -- Nedolazak se računa ako su ga označila bar dva učesnika ili kreator
         SELECT COUNT(*) FROM (
           SELECT r.match_id
           FROM match_ratings r
           JOIN matches m ON m.id = r.match_id
           WHERE r.rated_id = $1 AND r.vote = 'no_show'
           GROUP BY r.match_id, m.user_id
           HAVING COUNT(*) >= 2 OR BOOL_OR(r.rater_id = m.user_id)
         ) AS confirmed
       ) AS no_shows`,
    [user_id]
  );

  const row = result.rows[0];
  const fair = Number(row.fair);
  const unfair = Number(row.unfair);

  return {
    played: Number(row.played),
    fair,
    unfair,
    // Procenat fer pleja, null dok nema nijedne ocene
    fairPlay: fair + unfair > 0
      ? Math.round((fair / (fair + unfair)) * 100)
      : null,
    noShows: Number(row.no_shows),
  };
};

module.exports = {
  outcome,
  getResultStats,
  getPlayerStats,
};
