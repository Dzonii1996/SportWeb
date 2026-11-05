const pool = require("../database/db");
const { SPORTS } = require("../utils/fields");
const { describeMatch, notifyUsers } = require("../utils/notify");

const RESULT_DAYS = 7;
const MAX_SCORE = 999;

// Ishod za tim: 'W' pobeda, 'D' nerešeno, 'L' poraz
const outcome = (team, scoreA, scoreB) => {
  if (scoreA === scoreB) return "D";

  const won = team === "A" ? scoreA > scoreB : scoreB > scoreA;

  return won ? "W" : "L";
};

const OUTCOME_TEXT = {
  W: "🏆 Pobeda!",
  D: "🤝 Nerešeno.",
  L: "Poraz, ali sledeći put je vaš.",
};

// Kreator upisuje (ili briše, sa null) rezultat posle termina
const setResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { score_a, score_b } = req.body;

    const clearing = score_a === null && score_b === null;
    const valid = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;

    if (!clearing && !(valid(score_a) && valid(score_b))) {
      return res.status(400).json({
        success: false,
        message: "Rezultat mora biti ceo broj od 0 do 999 za oba tima.",
      });
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
      return res.status(404).json({
        success: false,
        message: "Termin ne postoji.",
      });
    }

    if (Number(matchData.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Samo kreator upisuje rezultat.",
      });
    }

    if (!matchData.started) {
      return res.status(400).json({
        success: false,
        message: "Rezultat se upisuje posle početka termina.",
      });
    }

    if (!matchData.open) {
      return res.status(400).json({
        success: false,
        message: `Rezultat može da se upiše najviše ${RESULT_DAYS} dana posle termina.`,
      });
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

      const score = `Tim A ${score_a} : ${score_b} Tim B`;
      const groups = { W: [], D: [], L: [], none: [] };

      for (const p of players.rows) {
        if (Number(p.user_id) === Number(req.user.id)) continue;
        groups[p.team ? outcome(p.team, score_a, score_b) : "none"].push(p.user_id);
      }

      for (const key of ["W", "D", "L"]) {
        await notifyUsers(
          pool,
          groups[key],
          `${OUTCOME_TEXT[key]} ${score} (${describeMatch(matchData)}).`,
          id
        );
      }

      await notifyUsers(
        pool,
        groups.none,
        `📋 Upisan je rezultat: ${score} (${describeMatch(matchData)}).`,
        id
      );
    }

    res.json({
      success: true,
      message: clearing ? "Rezultat je obrisan." : "Rezultat je sačuvan.",
      score_a,
      score_b,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
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

// Rang lista: pobeda 3 boda, nerešeno 1. ?sport=Tenis daje listu za jedan sport.
const getLeaderboard = async (req, res) => {
  try {
    const sport = req.query.sport || null;

    if (sport !== null && !SPORTS.includes(sport)) {
      return res.status(400).json({
        success: false,
        message: "Nepoznat sport.",
      });
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
            + COUNT(*) FILTER (WHERE result = 'D'))::int AS points
       FROM outcomes
       JOIN users ON users.id = outcomes.user_id
       GROUP BY users.id
       ORDER BY points DESC, wins DESC, played ASC, users.name
       LIMIT 50`,
      [sport]
    );

    res.json({
      success: true,
      players: result.rows,
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
  setResult,
  getResultStats,
  getLeaderboard,
  outcome,
};
