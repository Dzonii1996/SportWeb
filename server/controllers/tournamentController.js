const pool = require("../database/db");
const { isAdmin } = require("../utils/admin");
const { notifyUsers } = require("../utils/notify");
const { newShareToken } = require("../utils/privacy");
const { SPORTS, MAX_PRICE } = require("../utils/fields");
const { ACTIVE, bookSlot, parseDate } = require("./reservationController");
const {
  shuffle,
  roundRobin,
  nextSlot,
  knockoutBracket,
  judgeResult,
  computeStandings,
} = require("../utils/tournament");

const FORMATS = ["league", "knockout"];
const STATUSES = ["registration", "in_progress", "finished", "cancelled"];
const MAX_RULES = 2000;

// Greška sa statusom; handler je vraća kao JSON, a transakcija se poništava
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const handler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    // Jedinstveni indeks: naziv ekipe ili igrač koji je već u nekoj ekipi
    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message:
          error.constraint === "tournament_teams_name_unique"
            ? "Ekipa sa tim nazivom već postoji na turniru."
            : "Već si u jednoj ekipi na ovom turniru.",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Greška servera.",
    });
  }
};

const withTransaction = async (fn) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

// Turnir iz baze; "lock" čuva od istovremenih izmena (prijave, rezultati)
const findTournament = async (db, id, lock = false) => {
  const result = await db.query(
    `SELECT * FROM tournaments WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`,
    [Number(id) || 0]
  );

  if (!result.rows[0]) throw new HttpError(404, "Turnir ne postoji.");

  return result.rows[0];
};

const canManage = async (tournament, userId) =>
  Boolean(userId) &&
  (Number(tournament.organizer_id) === Number(userId) || (await isAdmin(userId)));

const requireManager = async (tournament, userId) => {
  if (!(await canManage(tournament, userId))) {
    throw new HttpError(403, "Samo organizator može ovo da uradi.");
  }
};

const requireRegistration = (tournament) => {
  if (tournament.status !== "registration") {
    throw new HttpError(400, "Prijave za ovaj turnir su zatvorene.");
  }
};

const findTeam = async (db, tournamentId, teamId) => {
  const result = await db.query(
    "SELECT * FROM tournament_teams WHERE id = $1 AND tournament_id = $2",
    [Number(teamId) || 0, tournamentId]
  );

  if (!result.rows[0]) throw new HttpError(404, "Ekipa ne postoji.");

  return result.rows[0];
};

// Svi igrači ekipa (ili jedne ekipe) na turniru, za notifikacije
const playersOf = async (db, tournamentId, teamIds = null) => {
  const result = await db.query(
    `SELECT DISTINCT p.user_id
     FROM tournament_team_players p
     JOIN tournament_teams t ON t.id = p.team_id
     WHERE p.tournament_id = $1 AND t.status = 'approved'
       AND ($2::int[] IS NULL OR p.team_id = ANY($2))`,
    [tournamentId, teamIds]
  );

  return result.rows.map((r) => r.user_id);
};

const parseInteger = (value, min, max, message) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, message);
  }

  return number;
};

// Proverava podatke turnira; vraća polja spremna za upis
const validateTournament = async (body, userId) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (name.length < 3 || name.length > 100) {
    throw new HttpError(400, "Naziv mora imati između 3 i 100 znakova.");
  }

  if (!SPORTS.includes(body.sport)) throw new HttpError(400, "Nepoznat sport.");
  if (!FORMATS.includes(body.format)) throw new HttpError(400, "Nepoznat format turnira.");

  const date = parseDate(body.start_date);

  if (!date) throw new HttpError(400, "Neispravan datum.");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (new Date(date[0], date[1] - 1, date[2]) < today) {
    throw new HttpError(400, "Turnir ne može biti u prošlosti.");
  }

  const maxTeams = parseInteger(body.max_teams, 2, 32, "Broj ekipa mora biti između 2 i 32.");
  const maxRoster = parseInteger(body.max_roster, 1, 30, "Broj igrača u ekipi mora biti između 1 i 30.");

  const fee =
    body.entry_fee === undefined || body.entry_fee === null || body.entry_fee === ""
      ? null
      : parseInteger(body.entry_fee, 0, MAX_PRICE, "Kotizacija mora biti ceo broj dinara (do 1.000.000).");

  const rules = typeof body.rules === "string" && body.rules.trim() !== "" ? body.rules.trim() : null;

  if (rules && rules.length > MAX_RULES) {
    throw new HttpError(400, `Pravila mogu imati najviše ${MAX_RULES} znakova.`);
  }

  const admin = await isAdmin(userId);
  let venue = null;

  if (body.venue_id !== undefined && body.venue_id !== null && body.venue_id !== "") {
    const result = await pool.query(
      "SELECT * FROM venues WHERE id = $1 AND status = 'approved'",
      [Number(body.venue_id) || 0]
    );

    venue = result.rows[0];

    if (!venue) throw new HttpError(400, "Izabrani teren ne postoji.");

    if (!venue.sports.includes(body.sport)) {
      throw new HttpError(400, `Teren "${venue.name}" nije za izabrani sport.`);
    }
  }

  // Vlasnik pravi turnire na svojim terenima; admin bilo gde
  if (!admin && (!venue || Number(venue.owner_id) !== Number(userId))) {
    throw new HttpError(403, "Turnir možeš da napraviš samo na svom terenu.");
  }

  const location = venue
    ? venue.name
    : typeof body.location === "string"
    ? body.location.trim()
    : "";

  if (location.length < 2 || location.length > 100) {
    throw new HttpError(400, "Lokacija mora imati između 2 i 100 znakova.");
  }

  return {
    name,
    sport: body.sport,
    format: body.format,
    venue_id: venue?.id ?? null,
    location,
    start_date: body.start_date,
    max_teams: maxTeams,
    max_roster: maxRoster,
    entry_fee: fee,
    rules,
  };
};

const createTournament = handler(async (req, res) => {
  const owned = await pool.query("SELECT 1 FROM venues WHERE owner_id = $1 LIMIT 1", [req.user.id]);

  if (owned.rows.length === 0 && !(await isAdmin(req.user.id))) {
    throw new HttpError(403, "Turnire prave admin i vlasnici terena.");
  }

  const v = await validateTournament(req.body, req.user.id);

  const result = await pool.query(
    `INSERT INTO tournaments
       (organizer_id, name, sport, format, venue_id, location, start_date,
        max_teams, max_roster, entry_fee, rules)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [req.user.id, v.name, v.sport, v.format, v.venue_id, v.location, v.start_date,
     v.max_teams, v.max_roster, v.entry_fee, v.rules]
  );

  res.status(201).json({
    success: true,
    message: "Turnir je napravljen. Prijave su otvorene.",
    tournament: result.rows[0],
  });
});

// Izmena je moguća samo dok traju prijave (posle postoji raspored)
const updateTournament = handler(async (req, res) => {
  const tournament = await findTournament(pool, req.params.id);

  await requireManager(tournament, req.user.id);
  requireRegistration(tournament);

  const v = await validateTournament(req.body, tournament.organizer_id);

  const result = await pool.query(
    `UPDATE tournaments
     SET name = $2, sport = $3, format = $4, venue_id = $5, location = $6, start_date = $7,
         max_teams = $8, max_roster = $9, entry_fee = $10, rules = $11
     WHERE id = $1
     RETURNING *`,
    [tournament.id, v.name, v.sport, v.format, v.venue_id, v.location, v.start_date,
     v.max_teams, v.max_roster, v.entry_fee, v.rules]
  );

  res.json({
    success: true,
    message: "Turnir je izmenjen.",
    tournament: result.rows[0],
  });
});

// Javna lista, uz filtere ?sport=Fudbal i ?status=registration
const getTournaments = handler(async (req, res) => {
  const { sport, status } = req.query;
  const where = [];
  const params = [];

  if (sport) {
    if (!SPORTS.includes(sport)) throw new HttpError(400, "Nepoznat sport.");
    params.push(sport);
    where.push(`t.sport = $${params.length}`);
  }

  if (status) {
    if (!STATUSES.includes(status)) throw new HttpError(400, "Nepoznat status.");
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT
       t.*,
       u.name AS organizer_name,
       w.name AS winner_name,
       (SELECT COUNT(*) FROM tournament_teams x
        WHERE x.tournament_id = t.id AND x.status = 'approved')::int AS teams_count
     FROM tournaments t
     JOIN users u ON u.id = t.organizer_id
     LEFT JOIN tournament_teams w ON w.id = t.winner_team_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY (t.status IN ('finished', 'cancelled')), t.start_date, t.id`,
    params
  );

  res.json({
    success: true,
    tournaments: result.rows,
  });
});

const getGames = async (db, tournamentId) => {
  const result = await db.query(
    `SELECT g.*, a.name AS team_a_name, b.name AS team_b_name, r.status AS reservation_status
     FROM tournament_games g
     LEFT JOIN tournament_teams a ON a.id = g.team_a_id
     LEFT JOIN tournament_teams b ON b.id = g.team_b_id
     LEFT JOIN venue_reservations r ON r.id = g.reservation_id
     WHERE g.tournament_id = $1
     ORDER BY g.round, g.position`,
    [tournamentId]
  );

  return result.rows;
};

// Stranica turnira. Svi vide odobrene ekipe; organizator i ekipe na čekanju.
// Link za pozivanje igrača vide samo kapiten i organizator.
const getTournament = handler(async (req, res) => {
  const tournament = await findTournament(pool, req.params.id);
  const userId = req.user?.id;
  const manager = await canManage(tournament, userId);

  const details = await pool.query(
    `SELECT u.name AS organizer_name, w.name AS winner_name
     FROM tournaments t
     JOIN users u ON u.id = t.organizer_id
     LEFT JOIN tournament_teams w ON w.id = t.winner_team_id
     WHERE t.id = $1`,
    [tournament.id]
  );

  const teams = await pool.query(
    `SELECT
       t.*,
       COALESCE(
         json_agg(json_build_object('id', u.id, 'name', u.name, 'avatar', u.avatar) ORDER BY p.created_at)
           FILTER (WHERE u.id IS NOT NULL),
         '[]'
       ) AS players
     FROM tournament_teams t
     LEFT JOIN tournament_team_players p ON p.team_id = t.id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE t.tournament_id = $1
     GROUP BY t.id
     ORDER BY t.created_at, t.id`,
    [tournament.id]
  );

  const isMine = (team) =>
    Boolean(userId) &&
    (Number(team.captain_id) === Number(userId) ||
      team.players.some((p) => Number(p.id) === Number(userId)));

  const visible = teams.rows
    .filter((t) => t.status === "approved" || manager || isMine(t))
    .map(({ invite_token: token, ...team }) =>
      manager || Number(team.captain_id) === Number(userId)
        ? { ...team, invite_token: token }
        : team
    );

  const games = await getGames(pool, tournament.id);
  const approved = teams.rows.filter((t) => t.status === "approved");

  res.json({
    success: true,
    tournament: { ...tournament, ...details.rows[0] },
    teams: visible,
    games,
    standings:
      tournament.format === "league" && games.length > 0
        ? computeStandings(approved, games, tournament.sport)
        : [],
    can_manage: manager,
    my_team_id: visible.find((t) => t.status !== "rejected" && isMine(t))?.id ?? null,
  });
});

// Kapiten prijavljuje ekipu; organizator je potvrđuje
const registerTeam = handler(async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

  if (name.length < 2 || name.length > 50) {
    throw new HttpError(400, "Naziv ekipe mora imati između 2 i 50 znakova.");
  }

  const team = await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    requireRegistration(tournament);

    const taken = await client.query(
      `SELECT COUNT(*)::int AS count FROM tournament_teams
       WHERE tournament_id = $1 AND status <> 'rejected'`,
      [tournament.id]
    );

    if (taken.rows[0].count >= tournament.max_teams) {
      throw new HttpError(400, "Turnir je popunjen.");
    }

    const inserted = await client.query(
      `INSERT INTO tournament_teams(tournament_id, name, captain_id, invite_token)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tournament.id, name, req.user.id, newShareToken()]
    );

    await client.query(
      "INSERT INTO tournament_team_players(team_id, tournament_id, user_id) VALUES ($1, $2, $3)",
      [inserted.rows[0].id, tournament.id, req.user.id]
    );

    if (Number(tournament.organizer_id) !== Number(req.user.id)) {
      await notifyUsers(
        client,
        [tournament.organizer_id],
        `🏆 Nova prijava na turnir "${tournament.name}": ekipa ${name}.`,
        null,
        { tournamentId: tournament.id }
      );
    }

    return inserted.rows[0];
  });

  res.status(201).json({
    success: true,
    message: "Ekipa je prijavljena. Čeka potvrdu organizatora.",
    team,
  });
});

const findTeamByToken = async (db, token, lock = false) => {
  const result = await db.query(
    `SELECT e.*, t.name AS tournament_name, t.sport, t.status AS tournament_status, t.max_roster,
            (SELECT COUNT(*) FROM tournament_team_players p WHERE p.team_id = e.id)::int AS players_count
     FROM tournament_teams e
     JOIN tournaments t ON t.id = e.tournament_id
     WHERE e.invite_token = $1 AND e.status <> 'rejected'
     ${lock ? "FOR UPDATE OF e" : ""}`,
    [typeof token === "string" ? token : ""]
  );

  if (!result.rows[0]) throw new HttpError(404, "Link nije ispravan.");

  return result.rows[0];
};

// Podaci za stranicu pozivnice (ko ima link, vidi naziv ekipe i turnira)
const getInvite = handler(async (req, res) => {
  const { invite_token: token, ...team } = await findTeamByToken(pool, req.params.token);

  res.json({
    success: true,
    team,
  });
});

const joinTeam = handler(async (req, res) => {
  const team = await withTransaction(async (client) => {
    const found = await findTeamByToken(client, req.params.token, true);

    if (found.tournament_status !== "registration") {
      throw new HttpError(400, "Prijave za ovaj turnir su zatvorene.");
    }

    if (found.players_count >= found.max_roster) {
      throw new HttpError(400, "Ekipa je popunjena.");
    }

    await client.query(
      "INSERT INTO tournament_team_players(team_id, tournament_id, user_id) VALUES ($1, $2, $3)",
      [found.id, found.tournament_id, req.user.id]
    );

    return found;
  });

  res.json({
    success: true,
    message: `Pridružio/la si se ekipi ${team.name}.`,
    tournament_id: team.tournament_id,
  });
});

// Igrač napušta ekipu ili ga kapiten ili organizator uklanja (dok traju prijave)
const removePlayer = handler(async (req, res) => {
  const tournament = await findTournament(pool, req.params.id);
  const team = await findTeam(pool, tournament.id, req.params.teamId);
  const target = Number(req.params.userId) || 0;

  requireRegistration(tournament);

  const allowed =
    target === Number(req.user.id) ||
    Number(team.captain_id) === Number(req.user.id) ||
    (await canManage(tournament, req.user.id));

  if (!allowed) throw new HttpError(403, "Nemate dozvolu.");

  if (target === Number(team.captain_id)) {
    throw new HttpError(400, "Kapiten ne može da napusti ekipu; može da odjavi celu ekipu.");
  }

  await pool.query(
    "DELETE FROM tournament_team_players WHERE team_id = $1 AND user_id = $2",
    [team.id, target]
  );

  res.json({
    success: true,
    message: "Igrač je uklonjen iz ekipe.",
  });
});

// Kapiten ili organizator odjavljuje ekipu (dok traju prijave)
const withdrawTeam = handler(async (req, res) => {
  const tournament = await findTournament(pool, req.params.id);
  const team = await findTeam(pool, tournament.id, req.params.teamId);

  requireRegistration(tournament);

  if (
    Number(team.captain_id) !== Number(req.user.id) &&
    !(await canManage(tournament, req.user.id))
  ) {
    throw new HttpError(403, "Nemate dozvolu.");
  }

  await pool.query("DELETE FROM tournament_teams WHERE id = $1", [team.id]);

  res.json({
    success: true,
    message: "Ekipa je odjavljena.",
  });
});

const approveTeam = handler(async (req, res) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    await requireManager(tournament, req.user.id);
    requireRegistration(tournament);

    const team = await findTeam(client, tournament.id, req.params.teamId);

    await client.query("UPDATE tournament_teams SET status = 'approved' WHERE id = $1", [team.id]);

    await notifyUsers(
      client,
      [team.captain_id],
      `✅ Ekipa ${team.name} je primljena na turnir "${tournament.name}".`,
      null,
      { tournamentId: tournament.id }
    );
  });

  res.json({
    success: true,
    message: "Ekipa je potvrđena.",
  });
});

// Odbijena ekipa ostaje zabeležena, a njeni igrači mogu da se prijave ponovo
const rejectTeamRow = async (client, tournament, team) => {
  await client.query("UPDATE tournament_teams SET status = 'rejected' WHERE id = $1", [team.id]);
  await client.query("DELETE FROM tournament_team_players WHERE team_id = $1", [team.id]);

  await notifyUsers(
    client,
    [team.captain_id],
    `❌ Ekipa ${team.name} nije primljena na turnir "${tournament.name}".`,
    null,
    { tournamentId: tournament.id }
  );
};

const rejectTeam = handler(async (req, res) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    await requireManager(tournament, req.user.id);
    requireRegistration(tournament);

    await rejectTeamRow(client, tournament, await findTeam(client, tournament.id, req.params.teamId));
  });

  res.json({
    success: true,
    message: "Ekipa je odbijena.",
  });
});

const setTeamPaid = handler(async (req, res) => {
  const tournament = await findTournament(pool, req.params.id);

  await requireManager(tournament, req.user.id);

  const team = await findTeam(pool, tournament.id, req.params.teamId);

  await pool.query("UPDATE tournament_teams SET paid = $2 WHERE id = $1", [
    team.id,
    req.body.paid === true,
  ]);

  res.json({
    success: true,
    message: "Sačuvano.",
  });
});

// Zatvara prijave i žreba raspored; ekipe na čekanju se odbijaju
const startTournament = handler(async (req, res) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    await requireManager(tournament, req.user.id);
    requireRegistration(tournament);

    const teams = await client.query(
      "SELECT * FROM tournament_teams WHERE tournament_id = $1 AND status <> 'rejected'",
      [tournament.id]
    );
    const approved = teams.rows.filter((t) => t.status === "approved");

    if (approved.length < 2) {
      throw new HttpError(400, "Za početak turnira trebaju bar 2 potvrđene ekipe.");
    }

    if (approved.length > tournament.max_teams) {
      throw new HttpError(400, `Potvrđeno je više ekipa nego što turnir prima (${tournament.max_teams}).`);
    }

    for (const team of teams.rows.filter((t) => t.status === "pending")) {
      await rejectTeamRow(client, tournament, team);
    }

    const ids = shuffle(approved.map((t) => t.id));
    const games = tournament.format === "league" ? roundRobin(ids) : knockoutBracket(ids);

    for (const g of games) {
      await client.query(
        `INSERT INTO tournament_games
           (tournament_id, round, position, team_a_id, team_b_id, winner_team_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tournament.id, g.round, g.position, g.team_a_id, g.team_b_id, g.winner_team_id]
      );
    }

    await client.query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1", [tournament.id]);

    await notifyUsers(
      client,
      await playersOf(client, tournament.id),
      `🏆 Turnir "${tournament.name}" je počeo. Raspored je objavljen.`,
      null,
      { tournamentId: tournament.id }
    );
  });

  res.json({
    success: true,
    message: "Turnir je počeo, raspored je napravljen.",
  });
});

const findGame = async (db, tournamentId, gameId) => {
  const result = await db.query(
    "SELECT * FROM tournament_games WHERE id = $1 AND tournament_id = $2",
    [Number(gameId) || 0, tournamentId]
  );

  if (!result.rows[0]) throw new HttpError(404, "Utakmica ne postoji.");

  return result.rows[0];
};

// Posle rezultata: ako su sve utakmice odigrane, turnir je završen
const updateTournamentState = async (client, tournament) => {
  const games = await getGames(client, tournament.id);
  let winnerId = null;

  if (tournament.format === "knockout") {
    winnerId = games[games.length - 1].winner_team_id;
  } else if (games.every((g) => g.score_a !== null)) {
    const teams = await client.query(
      "SELECT id, name FROM tournament_teams WHERE tournament_id = $1 AND status = 'approved'",
      [tournament.id]
    );

    winnerId = computeStandings(teams.rows, games, tournament.sport)[0].team_id;
  }

  if (winnerId === null) return;

  await client.query(
    "UPDATE tournaments SET status = 'finished', winner_team_id = $2 WHERE id = $1",
    [tournament.id, winnerId]
  );

  // Ispravka rezultata posle kraja ne šalje obaveštenje ponovo
  if (tournament.status === "finished") return;

  const winner = await client.query("SELECT name FROM tournament_teams WHERE id = $1", [winnerId]);

  await notifyUsers(
    client,
    await playersOf(client, tournament.id),
    `🏆 Turnir "${tournament.name}" je završen. Pobednik: ${winner.rows[0].name}!`,
    null,
    { tournamentId: tournament.id }
  );
};

// Organizator upisuje ili ispravlja rezultat. U kupu pobednik ide u sledeće kolo;
// ispravka nije moguća ako je sledeća utakmica već odigrana, a pobednik se menja.
const saveResult = handler(async (req, res) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    await requireManager(tournament, req.user.id);

    if (!["in_progress", "finished"].includes(tournament.status)) {
      throw new HttpError(400, "Turnir nije u toku.");
    }

    const game = await findGame(client, tournament.id, req.params.gameId);

    if (!game.team_a_id || !game.team_b_id) {
      throw new HttpError(400, "Utakmica još nema obe ekipe.");
    }

    const judged = judgeResult({
      sport: tournament.sport,
      format: tournament.format,
      scoreA: Number(req.body.score_a),
      scoreB: Number(req.body.score_b),
      penaltiesA: Number(req.body.penalties_a),
      penaltiesB: Number(req.body.penalties_b),
    });

    if (judged.error) throw new HttpError(400, judged.error);

    const winnerId =
      judged.winner === null ? null : judged.winner === "a" ? game.team_a_id : game.team_b_id;

    if (tournament.format === "knockout") {
      const next = nextSlot(game);
      const target = await client.query(
        "SELECT * FROM tournament_games WHERE tournament_id = $1 AND round = $2 AND position = $3",
        [tournament.id, next.round, next.position]
      );
      const nextGame = target.rows[0];

      if (nextGame) {
        if (
          nextGame.score_a !== null &&
          game.winner_team_id !== null &&
          Number(game.winner_team_id) !== Number(winnerId)
        ) {
          throw new HttpError(400, "Sledeća utakmica je već odigrana, pa pobednik ne može da se menja.");
        }

        await client.query(`UPDATE tournament_games SET ${next.slot} = $2 WHERE id = $1`, [
          nextGame.id,
          winnerId,
        ]);
      }
    }

    await client.query(
      `UPDATE tournament_games
       SET score_a = $2, score_b = $3, penalties_a = $4, penalties_b = $5, winner_team_id = $6
       WHERE id = $1`,
      [
        game.id,
        Number(req.body.score_a),
        Number(req.body.score_b),
        judged.penalties?.[0] ?? null,
        judged.penalties?.[1] ?? null,
        winnerId,
      ]
    );

    await updateTournamentState(client, tournament);
  });

  res.json({
    success: true,
    message: "Rezultat je sačuvan.",
  });
});

// Otkazuje aktivne rezervacije koje još nisu počele; vraća koliko ih je otkazano
const cancelReservations = async (client, reservationIds) => {
  const result = await client.query(
    `UPDATE venue_reservations
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = ANY($1) AND status = ANY($2)
       AND (reservation_date + make_interval(hours => start_hour)) > NOW()
     RETURNING id`,
    [reservationIds, ACTIVE]
  );

  return result.rows.length;
};

const venueOwner = async (client, tournament) => {
  if (!tournament.venue_id) return null;

  const result = await client.query(
    "SELECT owner_id, accepts_reservations FROM venues WHERE id = $1",
    [tournament.venue_id]
  );

  return result.rows[0] || null;
};

// Datum i vreme utakmice. Na terenu koji prima rezervacije utakmica rezerviše
// jedan sat (vlasnik potvrđuje); promena vremena otkazuje staru rezervaciju.
const scheduleGame = handler(async (req, res) => {
  const { game_date: gameDate, game_time: gameTime } = req.body;
  const clearing = !gameDate && !gameTime;

  await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    await requireManager(tournament, req.user.id);

    if (tournament.status !== "in_progress") {
      throw new HttpError(400, "Turnir nije u toku.");
    }

    const game = await findGame(client, tournament.id, req.params.gameId);

    if (!clearing) {
      const date = parseDate(gameDate);

      if (!date || !/^\d{2}:\d{2}$/.test(gameTime || "")) {
        throw new HttpError(400, "Neispravan datum ili vreme.");
      }

      const [hours, minutes] = gameTime.split(":").map(Number);

      if (hours > 23 || minutes > 59) throw new HttpError(400, "Neispravan datum ili vreme.");

      if (new Date(date[0], date[1] - 1, date[2], hours, minutes) < new Date()) {
        throw new HttpError(400, "Utakmica ne može biti u prošlosti.");
      }
    }

    const venue = await venueOwner(client, tournament);
    const bookable = Boolean(venue?.accepts_reservations && venue.owner_id);
    let reservationId = null;

    if (game.reservation_id) {
      const cancelled = await cancelReservations(client, [game.reservation_id]);

      if (cancelled > 0 && venue?.owner_id && Number(venue.owner_id) !== Number(req.user.id)) {
        await notifyUsers(
          client,
          [venue.owner_id],
          `🚫 Rezervacija za turnir "${tournament.name}" je otkazana (promenjen raspored).`,
          null,
          { reservationId: game.reservation_id }
        );
      }
    }

    if (!clearing && bookable) {
      if (!gameTime.endsWith(":00")) {
        throw new HttpError(400, "Teren se rezerviše na pun sat; izaberi vreme kao 19:00.");
      }

      const booked = await bookSlot(client, {
        venueId: tournament.venue_id,
        userId: req.user.id,
        date: gameDate,
        start: Number(gameTime.slice(0, 2)),
        hours: 1,
        note: `Turnir: ${tournament.name}`.slice(0, 300),
      });

      if (!booked.reservation) {
        throw new HttpError(booked.status === 404 ? 400 : booked.status, booked.message);
      }

      reservationId = booked.reservation.id;
    }

    await client.query(
      "UPDATE tournament_games SET game_date = $2, game_time = $3, reservation_id = $4 WHERE id = $1",
      [game.id, clearing ? null : gameDate, clearing ? null : gameTime, reservationId]
    );

    const teamIds = [game.team_a_id, game.team_b_id].filter(Boolean);

    if (!clearing && teamIds.length > 0) {
      const date = new Date(`${gameDate}T00:00`).toLocaleDateString("sr-Latn-RS");

      await notifyUsers(
        client,
        await playersOf(client, tournament.id, teamIds),
        `📅 Turnir "${tournament.name}": utakmica tvoje ekipe je ${date} u ${gameTime}.`,
        null,
        { tournamentId: tournament.id }
      );
    }
  });

  res.json({
    success: true,
    message: clearing ? "Vreme utakmice je uklonjeno." : "Vreme utakmice je sačuvano.",
  });
});

// Otkazivanje oslobađa rezervacije terena i obaveštava sve ekipe
const cancelTournament = handler(async (req, res) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, req.params.id, true);

    await requireManager(tournament, req.user.id);

    if (["finished", "cancelled"].includes(tournament.status)) {
      throw new HttpError(400, "Turnir je već završen ili otkazan.");
    }

    const games = await client.query(
      "SELECT reservation_id FROM tournament_games WHERE tournament_id = $1 AND reservation_id IS NOT NULL",
      [tournament.id]
    );
    const cancelled = await cancelReservations(client, games.rows.map((g) => g.reservation_id));
    const venue = await venueOwner(client, tournament);

    if (cancelled > 0 && venue?.owner_id && Number(venue.owner_id) !== Number(req.user.id)) {
      await notifyUsers(
        client,
        [venue.owner_id],
        `🚫 Turnir "${tournament.name}" je otkazan; rezervacije terena su oslobođene.`,
        null,
        { tournamentId: tournament.id }
      );
    }

    await client.query("UPDATE tournaments SET status = 'cancelled' WHERE id = $1", [tournament.id]);

    const captains = await client.query(
      "SELECT captain_id FROM tournament_teams WHERE tournament_id = $1 AND status = 'pending'",
      [tournament.id]
    );

    await notifyUsers(
      client,
      [...(await playersOf(client, tournament.id)), ...captains.rows.map((c) => c.captain_id)],
      `❌ Turnir "${tournament.name}" je otkazan.`,
      null,
      { tournamentId: tournament.id }
    );
  });

  res.json({
    success: true,
    message: "Turnir je otkazan.",
  });
});

module.exports = {
  createTournament,
  updateTournament,
  getTournaments,
  getTournament,
  registerTeam,
  getInvite,
  joinTeam,
  removePlayer,
  withdrawTeam,
  approveTeam,
  rejectTeam,
  setTeamPaid,
  startTournament,
  saveResult,
  scheduleGame,
  cancelTournament,
};
