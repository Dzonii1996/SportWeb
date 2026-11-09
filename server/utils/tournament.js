const { msg } = require("./i18n");
// Logika turnira bez baze: raspored, kup i tabela

const shuffle = (list) => {
  const result = [...list];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

// Liga: svako sa svakim, kružni raspored. Kod neparnog broja ekipa
// jedna ekipa svako kolo pauzira.
const roundRobin = (teamIds) => {
  const list = [...teamIds];

  if (list.length % 2 === 1) list.push(null);

  const games = [];
  const rounds = list.length - 1;

  for (let round = 1; round <= rounds; round++) {
    let position = 1;

    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];

      if (a !== null && b !== null) {
        games.push({ round, position: position++, team_a_id: a, team_b_id: b, winner_team_id: null });
      }
    }

    // Prva ekipa stoji, ostale se pomeraju za jedno mesto
    list.splice(1, 0, list.pop());
  }

  return games;
};

// Gde ide pobednik utakmice u kupu
const nextSlot = ({ round, position }) => ({
  round: round + 1,
  position: Math.ceil(position / 2),
  slot: position % 2 === 1 ? "team_a_id" : "team_b_id",
});

// Kup: sve utakmice do finala. Ako broj ekipa nije stepen dvojke,
// višak u prvom kolu dobija slobodan prolaz i odmah ide dalje.
const knockoutBracket = (teamIds) => {
  const size = 2 ** Math.ceil(Math.log2(teamIds.length));
  const rounds = Math.log2(size);
  const byes = size - teamIds.length;
  const games = [];
  const queue = [...teamIds];

  for (let position = 1; position <= size / 2; position++) {
    const a = queue.shift();
    const b = position <= byes ? null : queue.shift();

    games.push({
      round: 1,
      position,
      team_a_id: a,
      team_b_id: b,
      winner_team_id: b === null ? a : null,
    });
  }

  for (let round = 2; round <= rounds; round++) {
    for (let position = 1; position <= size / 2 ** round; position++) {
      games.push({ round, position, team_a_id: null, team_b_id: null, winner_team_id: null });
    }
  }

  games
    .filter((g) => g.winner_team_id !== null)
    .forEach((g) => {
      const next = nextSlot(g);
      const target = games.find((x) => x.round === next.round && x.position === next.position);

      if (target) target[next.slot] = g.winner_team_id;
    });

  return games;
};

// Proverava rezultat; vraća { error } ili { winner: "a" | "b" | null, penalties }.
// null kao pobednik znači nerešeno (samo fudbal u ligi).
const judgeResult = ({ sport, format, scoreA, scoreB, penaltiesA, penaltiesB }) => {
  const validScore = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

  if (!validScore(scoreA, 999) || !validScore(scoreB, 999)) {
    return { error: msg("common.theScoreMustBeA") };
  }

  if (scoreA !== scoreB) {
    return { winner: scoreA > scoreB ? "a" : "b", penalties: null };
  }

  if (sport === "Košarka") {
    return { error: msg("common.basketballHasNoDrawsEnter") };
  }

  // Tenis i odbojka: rezultat su osvojeni setovi
  if (sport !== "Fudbal") {
    return { error: msg("common.thisSportHasNoDraws") };
  }

  if (format === "league") {
    return { winner: null, penalties: null };
  }

  if (!validScore(penaltiesA, 99) || !validScore(penaltiesB, 99) || penaltiesA === penaltiesB) {
    return { error: msg("common.aCupMatchNeedsA") };
  }

  return { winner: penaltiesA > penaltiesB ? "a" : "b", penalties: [penaltiesA, penaltiesB] };
};

// Bodovi: fudbal 3/1/0, košarka 2 za pobedu i 1 za poraz, tenis i odbojka 2 za pobedu
const POINTS = {
  Fudbal: { win: 3, draw: 1, loss: 0 },
  Košarka: { win: 2, draw: 0, loss: 1 },
  Tenis: { win: 2, draw: 0, loss: 0 },
  Odbojka: { win: 2, draw: 0, loss: 0 },
};

const emptyRow = (team) => ({
  team_id: team.id,
  name: team.name,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  scored: 0,
  conceded: 0,
  diff: 0,
  points: 0,
});

const tally = (teams, games, sport) => {
  const rows = new Map(teams.map((t) => [t.id, emptyRow(t)]));
  const points = POINTS[sport];

  const add = (row, scored, conceded) => {
    row.played += 1;
    row.scored += scored;
    row.conceded += conceded;
    row.diff = row.scored - row.conceded;

    if (scored > conceded) {
      row.wins += 1;
      row.points += points.win;
    } else if (scored < conceded) {
      row.losses += 1;
      row.points += points.loss;
    } else {
      row.draws += 1;
      row.points += points.draw;
    }
  };

  games
    .filter((g) => g.score_a !== null && g.score_b !== null)
    .forEach((g) => {
      const a = rows.get(g.team_a_id);
      const b = rows.get(g.team_b_id);

      if (a && b) {
        add(a, g.score_a, g.score_b);
        add(b, g.score_b, g.score_a);
      }
    });

  return [...rows.values()];
};

// Tabela lige: bodovi, razlika (golovi, koševi ili setovi), međusobni susreti, više datih, pa naziv
const computeStandings = (teams, games, sport) => {
  const rows = tally(teams, games, sport);
  const groups = new Map();

  rows.forEach((row) => {
    const key = `${row.points}|${row.diff}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  const headToHead = new Map();

  groups.forEach((group) => {
    if (group.length < 2) return;

    const ids = new Set(group.map((r) => r.team_id));
    const mutual = games.filter((g) => ids.has(g.team_a_id) && ids.has(g.team_b_id));

    tally(group.map((r) => ({ id: r.team_id, name: r.name })), mutual, sport).forEach((r) =>
      headToHead.set(r.team_id, r.points)
    );
  });

  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.diff - a.diff ||
      (headToHead.get(b.team_id) ?? 0) - (headToHead.get(a.team_id) ?? 0) ||
      b.scored - a.scored ||
      a.name.localeCompare(b.name, "sr-Latn")
  );
};

module.exports = {
  shuffle,
  roundRobin,
  nextSlot,
  knockoutBracket,
  judgeResult,
  computeStandings,
};
