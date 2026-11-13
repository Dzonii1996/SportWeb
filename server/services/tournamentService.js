const { msg } = require("../utils/i18n");
const pool = require("../database/db");
const withTransaction = require("../database/transaction");
const { HttpError } = require("../utils/http");
const { parsePage, pageInfo } = require("../utils/pagination");
const { isAdmin } = require("../utils/admin");
const { notifyUsers } = require("../utils/notify");
const { newShareToken } = require("../utils/privacy");
const { SPORTS, MAX_PRICE } = require("../utils/fields");
const { ACTIVE, bookSlot, parseDate } = require("./reservationService");
const {
  shuffle,
  roundRobin,
  nextSlot,
  knockoutBracket,
  knockoutFromPairs,
  validatePairs,
  bracketSize,
  judgeResult,
  computeStandings,
} = require("../utils/tournament");

const FORMATS = ["league", "knockout"];
const STATUSES = ["registration", "in_progress", "finished", "cancelled"];
const MAX_RULES = 2000;

// Turnir iz baze; "lock" čuva od istovremenih izmena (prijave, rezultati)
const findTournament = async (db, id, lock = false) => {
  const result = await db.query(
    `SELECT * FROM tournaments WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`,
    [Number(id) || 0]
  );

  if (!result.rows[0]) throw new HttpError(404, msg("tournament.thisTournamentDoesntExist"));

  return result.rows[0];
};

const canManage = async (tournament, userId) =>
  Boolean(userId) &&
  (Number(tournament.organizer_id) === Number(userId) || (await isAdmin(userId)));

const requireManager = async (tournament, userId) => {
  if (!(await canManage(tournament, userId))) {
    throw new HttpError(403, msg("tournament.onlyTheOrganizerCanDo"));
  }
};

const requireRegistration = (tournament) => {
  if (tournament.status !== "registration") {
    throw new HttpError(400, msg("tournament.registrationForThisTournamentIs"));
  }
};

const findTeam = async (db, tournamentId, teamId) => {
  const result = await db.query(
    "SELECT * FROM tournament_teams WHERE id = $1 AND tournament_id = $2",
    [Number(teamId) || 0, tournamentId]
  );

  if (!result.rows[0]) throw new HttpError(404, msg("tournament.thisTeamDoesntExist"));

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
    throw new HttpError(400, msg("tournament.nameMustBeBetween3"));
  }

  if (!SPORTS.includes(body.sport)) throw new HttpError(400, msg("common.unknownSport"));
  if (!FORMATS.includes(body.format)) throw new HttpError(400, msg("tournament.unknownTournamentFormat"));

  const date = parseDate(body.start_date);

  if (!date) throw new HttpError(400, msg("common.invalidDate"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (new Date(date[0], date[1] - 1, date[2]) < today) {
    throw new HttpError(400, msg("tournament.aTournamentCantBeIn"));
  }

  const maxTeams = parseInteger(body.max_teams, 2, 32, msg("tournament.theNumberOfTeamsMust"));
  const maxRoster = parseInteger(body.max_roster, 1, 30, msg("tournament.theNumberOfPlayersPer"));

  const fee =
    body.entry_fee === undefined || body.entry_fee === null || body.entry_fee === ""
      ? null
      : parseInteger(body.entry_fee, 0, MAX_PRICE, msg("tournament.theEntryFeeMustBe"));

  const rules = typeof body.rules === "string" && body.rules.trim() !== "" ? body.rules.trim() : null;

  if (rules && rules.length > MAX_RULES) {
    throw new HttpError(400, msg("tournament.theRulesCanHaveAt", { n: MAX_RULES }));
  }

  const admin = await isAdmin(userId);
  let venue = null;

  if (body.venue_id !== undefined && body.venue_id !== null && body.venue_id !== "") {
    const result = await pool.query(
      "SELECT * FROM venues WHERE id = $1 AND status = 'approved'",
      [Number(body.venue_id) || 0]
    );

    venue = result.rows[0];

    if (!venue) throw new HttpError(400, msg("common.theSelectedVenueDoesntExist"));

    if (!venue.sports.includes(body.sport)) {
      throw new HttpError(400, msg("tournament.theVenueIsNotFor", { name: venue.name }));
    }
  }

  // Vlasnik pravi turnire na svojim terenima; admin bilo gde
  if (!admin && (!venue || Number(venue.owner_id) !== Number(userId))) {
    throw new HttpError(403, msg("tournament.youCanOnlyCreateA"));
  }

  const location = venue
    ? venue.name
    : typeof body.location === "string"
    ? body.location.trim()
    : "";

  if (location.length < 2 || location.length > 100) {
    throw new HttpError(400, msg("common.locationMustBeBetween2"));
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

const createTournament = async ({ userId, body }) => {
  const owned = await pool.query("SELECT 1 FROM venues WHERE owner_id = $1 LIMIT 1", [userId]);

  if (owned.rows.length === 0 && !(await isAdmin(userId))) {
    throw new HttpError(403, msg("tournament.tournamentsAreCreatedByThe"));
  }

  const v = await validateTournament(body, userId);

  const result = await pool.query(
    `INSERT INTO tournaments
       (organizer_id, name, sport, format, venue_id, location, start_date,
        max_teams, max_roster, entry_fee, rules)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [userId, v.name, v.sport, v.format, v.venue_id, v.location, v.start_date,
     v.max_teams, v.max_roster, v.entry_fee, v.rules]
  );

  return {
    message: msg("tournament.theTournamentWasCreatedRegistration"),
    tournament: result.rows[0],
  };
};

// Izmena je moguća samo dok traju prijave (posle postoji raspored)
const updateTournament = async ({ id, userId, body }) => {
  const tournament = await findTournament(pool, id);

  await requireManager(tournament, userId);
  requireRegistration(tournament);

  const v = await validateTournament(body, tournament.organizer_id);

  const result = await pool.query(
    `UPDATE tournaments
     SET name = $2, sport = $3, format = $4, venue_id = $5, location = $6, start_date = $7,
         max_teams = $8, max_roster = $9, entry_fee = $10, rules = $11
     WHERE id = $1
     RETURNING *`,
    [tournament.id, v.name, v.sport, v.format, v.venue_id, v.location, v.start_date,
     v.max_teams, v.max_roster, v.entry_fee, v.rules]
  );

  return {
    message: msg("tournament.theTournamentWasUpdated"),
    tournament: result.rows[0],
  };
};

// Javna lista, uz filtere ?sport=Fudbal i ?status=registration
const getTournaments = async ({ query }) => {
  const { sport, status } = query;
  const paging = parsePage(query);
  const where = [];
  const params = [];

  if (sport) {
    if (!SPORTS.includes(sport)) throw new HttpError(400, msg("common.unknownSport"));
    params.push(sport);
    where.push(`t.sport = $${params.length}`);
  }

  if (status) {
    if (!STATUSES.includes(status)) throw new HttpError(400, msg("common.unknownStatus"));
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT
       t.*,
       u.name AS organizer_name,
       w.name AS winner_name,
       (SELECT COUNT(*) FROM tournament_teams x
        WHERE x.tournament_id = t.id AND x.status = 'approved')::int AS teams_count,
       (SELECT thumb_path FROM photos ph WHERE ph.tournament_id = t.id ORDER BY ph.id LIMIT 1) AS cover_photo,
       COUNT(*) OVER() AS total_count
     FROM tournaments t
     JOIN users u ON u.id = t.organizer_id
     LEFT JOIN tournament_teams w ON w.id = t.winner_team_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY (t.status IN ('finished', 'cancelled')), t.start_date, t.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, paging.limit, paging.offset]
  );

  return {
    tournaments: result.rows.map(({ total_count, ...t }) => t),
    ...pageInfo(paging, Number(result.rows[0]?.total_count ?? 0)),
  };
};

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
const getTournament = async ({ id, userId }) => {
  const tournament = await findTournament(pool, id);
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

  return {
    tournament: { ...tournament, ...details.rows[0] },
    teams: visible,
    games,
    standings:
      tournament.format === "league" && games.length > 0
        ? computeStandings(approved, games, tournament.sport)
        : [],
    can_manage: manager,
    my_team_id: visible.find((t) => t.status !== "rejected" && isMine(t))?.id ?? null,
  };
};

// Kapiten prijavljuje ekipu; organizator je potvrđuje
const registerTeam = async ({ id, userId, body }) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (name.length < 2 || name.length > 50) {
    throw new HttpError(400, msg("tournament.theTeamNameMustBe"));
  }

  const team = await withTransaction(async (client) => {
    const tournament = await findTournament(client, id, true);

    requireRegistration(tournament);

    const taken = await client.query(
      `SELECT COUNT(*)::int AS count FROM tournament_teams
       WHERE tournament_id = $1 AND status <> 'rejected'`,
      [tournament.id]
    );

    if (taken.rows[0].count >= tournament.max_teams) {
      throw new HttpError(400, msg("tournament.theTournamentIsFull"));
    }

    const inserted = await client.query(
      `INSERT INTO tournament_teams(tournament_id, name, captain_id, invite_token)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tournament.id, name, userId, newShareToken()]
    );

    await client.query(
      "INSERT INTO tournament_team_players(team_id, tournament_id, user_id) VALUES ($1, $2, $3)",
      [inserted.rows[0].id, tournament.id, userId]
    );

    if (Number(tournament.organizer_id) !== Number(userId)) {
      await notifyUsers(
        client,
        [tournament.organizer_id],
        msg("tournament.newRegistrationForTheTournament", { tournament: tournament.name, team: name }),
        null,
        { tournamentId: tournament.id }
      );
    }

    return inserted.rows[0];
  });

  return {
    message: msg("tournament.theTeamIsRegisteredAnd"),
    team,
  };
};

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

  if (!result.rows[0]) throw new HttpError(404, msg("tournament.theLinkIsntValid"));

  return result.rows[0];
};

// Podaci za stranicu pozivnice (ko ima link, vidi naziv ekipe i turnira)
const getInvite = async ({ token }) => {
  const { invite_token: inviteToken, ...team } = await findTeamByToken(pool, token);

  return {
    team,
  };
};

const joinTeam = async ({ token, userId }) => {
  const team = await withTransaction(async (client) => {
    const found = await findTeamByToken(client, token, true);

    if (found.tournament_status !== "registration") {
      throw new HttpError(400, msg("tournament.registrationForThisTournamentIs"));
    }

    if (found.players_count >= found.max_roster) {
      throw new HttpError(400, msg("tournament.theTeamIsFull"));
    }

    await client.query(
      "INSERT INTO tournament_team_players(team_id, tournament_id, user_id) VALUES ($1, $2, $3)",
      [found.id, found.tournament_id, userId]
    );

    return found;
  });

  return {
    message: msg("tournament.youJoinedTheTeam", { name: team.name }),
    tournament_id: team.tournament_id,
  };
};

// Igrač napušta ekipu ili ga kapiten ili organizator uklanja (dok traju prijave)
const removePlayer = async ({ id, teamId, playerId, userId }) => {
  const tournament = await findTournament(pool, id);
  const team = await findTeam(pool, tournament.id, teamId);
  const target = Number(playerId) || 0;

  requireRegistration(tournament);

  const allowed =
    target === Number(userId) ||
    Number(team.captain_id) === Number(userId) ||
    (await canManage(tournament, userId));

  if (!allowed) throw new HttpError(403, msg("common.youDontHavePermission"));

  if (target === Number(team.captain_id)) {
    throw new HttpError(400, msg("tournament.theCaptainCantLeaveThe"));
  }

  await pool.query(
    "DELETE FROM tournament_team_players WHERE team_id = $1 AND user_id = $2",
    [team.id, target]
  );

  return {
    message: msg("tournament.thePlayerWasRemovedFrom"),
  };
};

// Kapiten ili organizator odjavljuje ekipu (dok traju prijave)
const withdrawTeam = async ({ id, teamId, userId }) => {
  const tournament = await findTournament(pool, id);
  const team = await findTeam(pool, tournament.id, teamId);

  requireRegistration(tournament);

  if (
    Number(team.captain_id) !== Number(userId) &&
    !(await canManage(tournament, userId))
  ) {
    throw new HttpError(403, msg("common.youDontHavePermission"));
  }

  await pool.query("DELETE FROM tournament_teams WHERE id = $1", [team.id]);

  return {
    message: msg("tournament.theTeamWasWithdrawn"),
  };
};

const approveTeam = async ({ id, teamId, userId }) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, id, true);

    await requireManager(tournament, userId);
    requireRegistration(tournament);

    const team = await findTeam(client, tournament.id, teamId);

    await client.query("UPDATE tournament_teams SET status = 'approved' WHERE id = $1", [team.id]);

    await notifyUsers(
      client,
      [team.captain_id],
      msg("tournament.teamWasAcceptedToThe", { team: team.name, tournament: tournament.name }),
      null,
      { tournamentId: tournament.id }
    );
  });

  return {
    message: msg("tournament.theTeamWasConfirmed"),
  };
};

// Odbijena ekipa ostaje zabeležena, a njeni igrači mogu da se prijave ponovo
const rejectTeamRow = async (client, tournament, team) => {
  await client.query("UPDATE tournament_teams SET status = 'rejected' WHERE id = $1", [team.id]);
  await client.query("DELETE FROM tournament_team_players WHERE team_id = $1", [team.id]);

  await notifyUsers(
    client,
    [team.captain_id],
    msg("tournament.teamWasntAcceptedToThe", { team: team.name, tournament: tournament.name }),
    null,
    { tournamentId: tournament.id }
  );
};

const rejectTeam = async ({ id, teamId, userId }) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, id, true);

    await requireManager(tournament, userId);
    requireRegistration(tournament);

    await rejectTeamRow(client, tournament, await findTeam(client, tournament.id, teamId));
  });

  return {
    message: msg("tournament.theTeamWasRejected"),
  };
};

const setTeamPaid = async ({ id, teamId, userId, body }) => {
  const tournament = await findTournament(pool, id);

  await requireManager(tournament, userId);

  const team = await findTeam(pool, tournament.id, teamId);

  await pool.query("UPDATE tournament_teams SET paid = $2 WHERE id = $1", [
    team.id,
    body.paid === true,
  ]);

  return {
    message: msg("tournament.saved"),
  };
};

// Zatvara prijave i žreba raspored; ekipe na čekanju se odbijaju
// body.pairs (po želji, samo za kup): parovi prvog kola iz žreba održanog van aplikacije.
// Bez toga aplikacija sama izvlači parove.
const startTournament = async ({ id, userId, body = {} }) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, id, true);

    await requireManager(tournament, userId);
    requireRegistration(tournament);

    const teams = await client.query(
      "SELECT * FROM tournament_teams WHERE tournament_id = $1 AND status <> 'rejected'",
      [tournament.id]
    );
    const approved = teams.rows.filter((t) => t.status === "approved");

    if (approved.length < 2) {
      throw new HttpError(400, msg("tournament.atLeast2ConfirmedTeams"));
    }

    if (approved.length > tournament.max_teams) {
      throw new HttpError(400, msg("tournament.moreTeamsAreConfirmedThan", { n: tournament.max_teams }));
    }

    for (const team of teams.rows.filter((t) => t.status === "pending")) {
      await rejectTeamRow(client, tournament, team);
    }

    const ids = approved.map((t) => t.id);
    let games;

    if (body.pairs !== undefined && body.pairs !== null) {
      if (tournament.format !== "knockout") {
        throw new HttpError(400, msg("tournament.drawOnlyForCup"));
      }

      const pairs = validatePairs(body.pairs, ids);

      if (!pairs) {
        throw new HttpError(400, msg("tournament.drawInvalid", { n: bracketSize(ids.length) / 2 }));
      }

      games = knockoutFromPairs(pairs);
    } else {
      const drawn = shuffle(ids);
      games = tournament.format === "league" ? roundRobin(drawn) : knockoutBracket(drawn);
    }

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
      msg("tournament.theTournamentHasStartedThe", { tournament: tournament.name }),
      null,
      { tournamentId: tournament.id }
    );
  });

  return {
    message: msg("tournament.theTournamentHasStartedAnd"),
  };
};

const findGame = async (db, tournamentId, gameId) => {
  const result = await db.query(
    "SELECT * FROM tournament_games WHERE id = $1 AND tournament_id = $2",
    [Number(gameId) || 0, tournamentId]
  );

  if (!result.rows[0]) throw new HttpError(404, msg("tournament.thisMatchDoesntExist"));

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
    msg("tournament.theTournamentIsFinishedWinner", { tournament: tournament.name, winner: winner.rows[0].name }),
    null,
    { tournamentId: tournament.id }
  );
};

// Organizator upisuje ili ispravlja rezultat. U kupu pobednik ide u sledeće kolo;
// ispravka nije moguća ako je sledeća utakmica već odigrana, a pobednik se menja.
const saveResult = async ({ id, gameId, userId, body }) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, id, true);

    await requireManager(tournament, userId);

    if (!["in_progress", "finished"].includes(tournament.status)) {
      throw new HttpError(400, msg("tournament.theTournamentIsntInProgress"));
    }

    const game = await findGame(client, tournament.id, gameId);

    if (!game.team_a_id || !game.team_b_id) {
      throw new HttpError(400, msg("tournament.thisMatchDoesntHaveBoth"));
    }

    const judged = judgeResult({
      sport: tournament.sport,
      format: tournament.format,
      scoreA: Number(body.score_a),
      scoreB: Number(body.score_b),
      penaltiesA: Number(body.penalties_a),
      penaltiesB: Number(body.penalties_b),
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
          throw new HttpError(400, msg("tournament.theNextMatchHasAlready"));
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
        Number(body.score_a),
        Number(body.score_b),
        judged.penalties?.[0] ?? null,
        judged.penalties?.[1] ?? null,
        winnerId,
      ]
    );

    await updateTournamentState(client, tournament);
  });

  return {
    message: msg("common.theResultWasSaved"),
  };
};

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

// Proverava "YYYY-MM-DD" i "HH:MM"; vreme ne sme biti u prošlosti
const checkDateTime = (gameDate, gameTime) => {
  const date = parseDate(gameDate);

  if (!date || !/^\d{2}:\d{2}$/.test(gameTime || "")) {
    throw new HttpError(400, msg("common.invalidDateOrTime"));
  }

  const [hours, minutes] = gameTime.split(":").map(Number);

  if (hours > 23 || minutes > 59) throw new HttpError(400, msg("common.invalidDateOrTime"));

  if (new Date(date[0], date[1] - 1, date[2], hours, minutes) < new Date()) {
    throw new HttpError(400, msg("tournament.aMatchCantBeIn"));
  }
};

// Postavlja (ili briše, bez datuma) vreme jedne utakmice u otvorenoj transakciji:
// stara rezervacija terena se otkazuje, nova pravi, a igrači obe ekipe dobijaju obaveštenje
const setGameTime = async (client, { tournament, game, userId, venue, gameDate, gameTime }) => {
  const clearing = !gameDate;
  const bookable = Boolean(venue?.accepts_reservations && venue.owner_id);
  let reservationId = null;

  if (game.reservation_id) {
    const cancelled = await cancelReservations(client, [game.reservation_id]);

    if (cancelled > 0 && venue?.owner_id && Number(venue.owner_id) !== Number(userId)) {
      await notifyUsers(
        client,
        [venue.owner_id],
        msg("tournament.theBookingForTheTournament", { tournament: tournament.name }),
        null,
        { reservationId: game.reservation_id }
      );
    }
  }

  if (!clearing && bookable) {
    if (!gameTime.endsWith(":00")) {
      throw new HttpError(400, msg("tournament.venuesAreBookedByThe"));
    }

    const booked = await bookSlot(client, {
      venueId: tournament.venue_id,
      userId: userId,
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
      msg("tournament.tournamentYourTeamsMatchIs", { tournament: tournament.name, date, time: gameTime }),
      null,
      { tournamentId: tournament.id }
    );
  }
};

// Turnir koji je u toku, zaključan za izmenu, i samo za organizatora
const openForScheduling = async (client, id, userId) => {
  const tournament = await findTournament(client, id, true);

  await requireManager(tournament, userId);

  if (tournament.status !== "in_progress") {
    throw new HttpError(400, msg("tournament.theTournamentIsntInProgress"));
  }

  return tournament;
};

// Datum i vreme utakmice. Na terenu koji prima rezervacije utakmica rezerviše
// jedan sat (vlasnik potvrđuje); promena vremena otkazuje staru rezervaciju.
const scheduleGame = async ({ id, gameId, userId, body }) => {
  const { game_date: gameDate, game_time: gameTime } = body;
  const clearing = !gameDate && !gameTime;

  if (!clearing) checkDateTime(gameDate, gameTime);

  await withTransaction(async (client) => {
    const tournament = await openForScheduling(client, id, userId);
    const game = await findGame(client, tournament.id, gameId);
    const venue = await venueOwner(client, tournament);

    await setGameTime(client, {
      tournament,
      game,
      userId,
      venue,
      gameDate: clearing ? null : gameDate,
      gameTime,
    });
  });

  return {
    message: clearing ? msg("tournament.theMatchTimeWasRemoved") : msg("tournament.theMatchTimeWasSaved"),
  };
};

const ROUND_INTERVALS = [30, 45, 60, 75, 90, 120];

// Celo kolo odjednom, kad se turnir igra više dana: prva utakmica u start_time,
// svaka sledeća "interval" minuta kasnije. Slobodni prolazi se preskaču.
// Sve ili ništa: ako jedan termin ne može (npr. teren zauzet), kolo ostaje kako je bilo.
const scheduleRound = async ({ id, round, userId, body }) => {
  const { game_date: gameDate, start_time: startTime } = body;
  const interval = body.interval === undefined ? 60 : Number(body.interval);

  if (!ROUND_INTERVALS.includes(interval)) {
    throw new HttpError(400, msg("tournament.invalidInterval"));
  }

  checkDateTime(gameDate, startTime);

  const [hours, minutes] = startTime.split(":").map(Number);
  let scheduled = 0;

  await withTransaction(async (client) => {
    const tournament = await openForScheduling(client, id, userId);
    const games = await client.query(
      `SELECT * FROM tournament_games
       WHERE tournament_id = $1 AND round = $2
       ORDER BY position`,
      [tournament.id, Number(round) || 0]
    );
    // Slobodan prolaz: ima pobednika, a fali jedna ekipa
    const playable = games.rows.filter(
      (g) => !(g.winner_team_id !== null && (g.team_a_id === null || g.team_b_id === null))
    );

    if (playable.length === 0) throw new HttpError(404, msg("tournament.noGamesInThisRound"));

    const last = hours * 60 + minutes + (playable.length - 1) * interval;

    if (last >= 24 * 60) throw new HttpError(400, msg("tournament.roundDoesntFitInDay"));

    const venue = await venueOwner(client, tournament);

    for (const [i, game] of playable.entries()) {
      const start = hours * 60 + minutes + i * interval;
      const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;

      await setGameTime(client, { tournament, game, userId, venue, gameDate, gameTime: time });
    }

    scheduled = playable.length;
  });

  return {
    message: msg("tournament.roundScheduled", { n: scheduled }),
  };
};

// Otkazivanje oslobađa rezervacije terena i obaveštava sve ekipe
const cancelTournament = async ({ id, userId }) => {
  await withTransaction(async (client) => {
    const tournament = await findTournament(client, id, true);

    await requireManager(tournament, userId);

    if (["finished", "cancelled"].includes(tournament.status)) {
      throw new HttpError(400, msg("tournament.theTournamentIsAlreadyFinished"));
    }

    const games = await client.query(
      "SELECT reservation_id FROM tournament_games WHERE tournament_id = $1 AND reservation_id IS NOT NULL",
      [tournament.id]
    );
    const cancelled = await cancelReservations(client, games.rows.map((g) => g.reservation_id));
    const venue = await venueOwner(client, tournament);

    if (cancelled > 0 && venue?.owner_id && Number(venue.owner_id) !== Number(userId)) {
      await notifyUsers(
        client,
        [venue.owner_id],
        msg("tournament.theTournamentWasCancelledVenue", { tournament: tournament.name }),
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
      msg("tournament.theTournamentWasCancelled2", { tournament: tournament.name }),
      null,
      { tournamentId: tournament.id }
    );
  });

  return {
    message: msg("tournament.theTournamentWasCancelled"),
  };
};

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
  scheduleRound,
  cancelTournament,
};
