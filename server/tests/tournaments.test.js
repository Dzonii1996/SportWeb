const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  makeAdmin,
  createVenue,
} = require("./helpers");
const {
  roundRobin,
  knockoutBracket,
  validatePairs,
  judgeResult,
  computeStandings,
} = require("../utils/tournament");

beforeEach(resetDb);
afterAll(() => pool.end());

const body = (overrides = {}) => ({
  name: "Letnji kup",
  sport: "Fudbal",
  format: "league",
  location: "Gradski stadion",
  start_date: dateIn(10),
  max_teams: 8,
  max_roster: 7,
  entry_fee: 5000,
  rules: "Fer plej.",
  ...overrides,
});

const adminUser = async () => {
  const admin = await createUser();
  await makeAdmin(admin);

  return admin;
};

const create = async (organizer, overrides = {}) =>
  (await api.post("/api/tournaments").set(auth(organizer)).send(body(overrides))).body.tournament;

const register = (t, user, name) =>
  api.post(`/api/tournaments/${t.id}/teams`).set(auth(user)).send({ name });

// N potvrđenih ekipa; vraća ekipe sa kapitenima
const approvedTeams = async (t, organizer, count) => {
  const teams = [];

  for (let i = 1; i <= count; i++) {
    const captain = await createUser();
    const { team } = (await register(t, captain, `Ekipa ${i}`)).body;

    await api.post(`/api/tournaments/${t.id}/teams/${team.id}/approve`).set(auth(organizer));
    teams.push({ ...team, captain });
  }

  return teams;
};

const start = (t, organizer) => api.post(`/api/tournaments/${t.id}/start`).set(auth(organizer));

const details = async (t, user) => {
  const req = api.get(`/api/tournaments/${t.id}`);

  return (await (user ? req.set(auth(user)) : req)).body;
};

const result = (t, game, organizer, scoreA, scoreB, extra = {}) =>
  api
    .put(`/api/tournaments/${t.id}/games/${game.id}/result`)
    .set(auth(organizer))
    .send({ score_a: scoreA, score_b: scoreB, ...extra });

const messagesOf = async (user) =>
  (
    await pool.query("SELECT message, tournament_id FROM notifications WHERE user_id = $1 ORDER BY id", [user.id])
  ).rows;

describe("raspored i tabela (bez baze)", () => {
  test.each([[2, 1], [3, 3], [4, 6], [5, 10], [6, 15]])(
    "liga sa %i ekipa ima %i utakmica i svaki par igra jednom",
    (count, total) => {
      const ids = Array.from({ length: count }, (_, i) => i + 1);
      const games = roundRobin(ids);
      const pairs = new Set(games.map((g) => [g.team_a_id, g.team_b_id].sort().join("-")));

      expect(games).toHaveLength(total);
      expect(pairs.size).toBe(total);
    }
  );

  test("u jednom kolu lige ekipa igra najviše jednom", () => {
    const games = roundRobin([1, 2, 3, 4, 5, 6]);

    for (const round of new Set(games.map((g) => g.round))) {
      const ids = games.filter((g) => g.round === round).flatMap((g) => [g.team_a_id, g.team_b_id]);

      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("kup sa 8 ekipa ima 7 utakmica u 3 kola", () => {
    const games = knockoutBracket([1, 2, 3, 4, 5, 6, 7, 8]);

    expect(games).toHaveLength(7);
    expect(games.filter((g) => g.round === 1)).toHaveLength(4);
    expect(games.filter((g) => g.round === 3)).toHaveLength(1);
  });

  test("kup sa 6 ekipa: dve dobijaju slobodan prolaz u drugo kolo", () => {
    const games = knockoutBracket([1, 2, 3, 4, 5, 6]);
    const byes = games.filter((g) => g.round === 1 && g.team_b_id === null);

    expect(byes.map((g) => g.winner_team_id)).toEqual([1, 2]);
    expect(games.find((g) => g.round === 2 && g.position === 1)).toMatchObject({ team_a_id: 1, team_b_id: 2 });
  });

  test("fudbal: nerešeno u ligi može, u kupu traži penale", () => {
    const base = { sport: "Fudbal", scoreA: 1, scoreB: 1 };

    expect(judgeResult({ ...base, format: "league" }).winner).toBeNull();
    expect(String(judgeResult({ ...base, format: "knockout" }).error)).toMatch(/penale/);
    expect(String(judgeResult({ ...base, format: "knockout", penaltiesA: 3, penaltiesB: 3 }).error)).toMatch(/penale/);
    expect(judgeResult({ ...base, format: "knockout", penaltiesA: 5, penaltiesB: 4 }).winner).toBe("a");
  });

  test("košarka nema nerešeno", () => {
    const judged = judgeResult({ sport: "Košarka", format: "league", scoreA: 70, scoreB: 70 });

    expect(String(judged.error)).toMatch(/nema nerešenog/);
  });

  const teams = [{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }];
  const game = (a, b, sa, sb) => ({ team_a_id: a, team_b_id: b, score_a: sa, score_b: sb });

  test("fudbal: 3 boda za pobedu, 1 za nerešeno", () => {
    const table = computeStandings(teams, [game(1, 2, 2, 0), game(1, 3, 1, 1), game(2, 3, 0, 0)], "Fudbal");

    expect(table[0]).toMatchObject({ name: "A", points: 4, wins: 1, draws: 1, diff: 2 });
    expect(table.map((r) => r.name)).toEqual(["A", "C", "B"]);
  });

  test("košarka: 2 boda za pobedu, 1 za poraz", () => {
    const table = computeStandings(teams.slice(0, 2), [game(1, 2, 80, 70)], "Košarka");

    expect(table.map((r) => r.points)).toEqual([2, 1]);
  });

  test("jednaki bodovi: prvo odlučuje razlika", () => {
    const table = computeStandings(teams, [game(1, 3, 1, 0), game(2, 3, 5, 0)], "Fudbal");

    expect(table[0].name).toBe("B");
  });

  test("isti bodovi i razlika: odlučuje međusobni susret, ne naziv", () => {
    const four = [...teams, { id: 4, name: "D" }];

    // A i B: po 3 boda, razlika 0, po jedan dat gol; B je pobedio A
    const table = computeStandings(
      four,
      [game(2, 1, 1, 0), game(1, 3, 1, 0), game(4, 2, 1, 0)],
      "Fudbal"
    );

    expect(table.map((r) => r.name)).toEqual(["D", "B", "A", "C"]);
  });
});

describe("pravljenje turnira", () => {
  test("admin pravi turnir sa otvorenim prijavama", async () => {
    const admin = await adminUser();

    const res = await api.post("/api/tournaments").set(auth(admin)).send(body());

    expect(res.status).toBe(201);
    expect(res.body.tournament).toMatchObject({ status: "registration", format: "league", entry_fee: 5000 });
  });

  test("običan korisnik ne može da napravi turnir", async () => {
    const user = await createUser();

    const res = await api.post("/api/tournaments").set(auth(user)).send(body());

    expect(res.status).toBe(403);
  });

  test("vlasnik pravi turnir samo na svom terenu", async () => {
    const [owner, other] = [await createUser(), await createUser()];
    const venue = await createVenue();
    const foreign = await createVenue({ name: "Tuđi" });
    await pool.query("UPDATE venues SET owner_id = $1 WHERE id = $2", [owner.id, venue.id]);
    await pool.query("UPDATE venues SET owner_id = $1 WHERE id = $2", [other.id, foreign.id]);

    const own = await api.post("/api/tournaments").set(auth(owner)).send(body({ venue_id: venue.id }));
    const notOwn = await api.post("/api/tournaments").set(auth(owner)).send(body({ venue_id: foreign.id }));
    const noVenue = await api.post("/api/tournaments").set(auth(owner)).send(body());

    expect(own.status).toBe(201);
    expect(own.body.tournament.location).toBe("Sportski centar");
    expect([notOwn.status, noVenue.status]).toEqual([403, 403]);
  });

  test("teren mora biti za izabrani sport", async () => {
    const admin = await adminUser();
    const venue = await createVenue({ sports: ["Fudbal"] });

    const res = await api
      .post("/api/tournaments")
      .set(auth(admin))
      .send(body({ sport: "Košarka", venue_id: venue.id }));

    expect(res.status).toBe(400);
  });

  test.each([
    ["kratak naziv", { name: "x" }, /Naziv/],
    ["nepoznat sport", { sport: "Hokej" }, /sport/],
    ["nepoznat format", { format: "kviz" }, /format/],
    ["datum u prošlosti", { start_date: dateIn(-1) }, /prošlosti/],
    ["premalo ekipa", { max_teams: 1 }, /ekipa/],
    ["previše igrača", { max_roster: 31 }, /igrača/],
    ["negativna kotizacija", { entry_fee: -1 }, /Kotizacija/],
    ["bez lokacije", { location: "" }, /Lokacija/],
  ])("odbijen je turnir: %s", async (_, overrides, message) => {
    const admin = await adminUser();

    const res = await api.post("/api/tournaments").set(auth(admin)).send(body(overrides));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  test("lista je javna i ima filtere", async () => {
    const admin = await adminUser();
    await create(admin, { name: "Fudbalski" });
    const basket = await create(admin, { name: "Košarkaški", sport: "Košarka" });
    await api.post(`/api/tournaments/${basket.id}/cancel`).set(auth(admin));

    const names = async (q) =>
      (await api.get(`/api/tournaments${q}`)).body.tournaments.map((t) => t.name);

    expect(await names("")).toEqual(["Fudbalski", "Košarkaški"]);
    expect(await names("?sport=Košarka")).toEqual(["Košarkaški"]);
    expect(await names("?status=registration")).toEqual(["Fudbalski"]);
    expect((await api.get("/api/tournaments?sport=Hokej")).status).toBe(400);
  });

  test("samo organizator menja turnir, i samo dok traju prijave", async () => {
    const [admin, organizer, user] = [await adminUser(), await adminUser(), await createUser()];
    const t = await create(organizer);

    const foreign = await api.put(`/api/tournaments/${t.id}`).set(auth(user)).send(body());
    const byAdmin = await api.put(`/api/tournaments/${t.id}`).set(auth(admin)).send(body({ name: "Novi naziv" }));

    expect(foreign.status).toBe(403);
    expect(byAdmin.body.tournament.name).toBe("Novi naziv");

    await approvedTeams(t, organizer, 2);
    await start(t, organizer);

    const late = await api.put(`/api/tournaments/${t.id}`).set(auth(organizer)).send(body());
    expect(late.status).toBe(400);
  });
});

describe("prijava ekipa", () => {
  test("kapiten prijavljuje ekipu, organizator dobija notifikaciju i potvrđuje", async () => {
    const [organizer, captain] = [await adminUser(), await createUser("Kapiten")];
    const t = await create(organizer);

    const res = await register(t, captain, "Zvezdice");

    expect(res.status).toBe(201);
    expect(res.body.team.status).toBe("pending");
    expect((await messagesOf(organizer))[0]).toMatchObject({ tournament_id: t.id });
    expect((await details(t)).teams).toHaveLength(0);

    await api.post(`/api/tournaments/${t.id}/teams/${res.body.team.id}/approve`).set(auth(organizer));

    const page = await details(t);
    expect(page.teams[0]).toMatchObject({ name: "Zvezdice", status: "approved" });
    expect(page.teams[0].players.map((p) => p.name)).toEqual(["Kapiten"]);
    expect(page.teams[0].invite_token).toBeUndefined();
    expect((await messagesOf(captain))[0].message).toMatch(/primljena/);
  });

  test("kapiten i organizator vide link, a kapiten svoju ekipu na čekanju", async () => {
    const [organizer, captain, other] = [await adminUser(), await createUser(), await createUser()];
    const t = await create(organizer);
    const { team } = (await register(t, captain, "Zvezdice")).body;

    const asCaptain = await details(t, captain);
    const asOrganizer = await details(t, organizer);
    const asOther = await details(t, other);

    expect(asCaptain.my_team_id).toBe(team.id);
    expect(asCaptain.teams[0].invite_token).toBe(team.invite_token);
    expect(asOrganizer.teams[0].invite_token).toBe(team.invite_token);
    expect(asOrganizer.can_manage).toBe(true);
    expect(asOther.teams).toHaveLength(0);
    expect(asOther.can_manage).toBe(false);
  });

  test("igrač ulazi u ekipu preko linka, do popunjavanja", async () => {
    const [organizer, captain, player, late] = [
      await adminUser(),
      await createUser(),
      await createUser(),
      await createUser(),
    ];
    const t = await create(organizer, { max_roster: 2 });
    const { team } = (await register(t, captain, "Zvezdice")).body;
    const join = (user) =>
      api.post(`/api/tournaments/invite/${team.invite_token}/join`).set(auth(user));

    const invite = await api.get(`/api/tournaments/invite/${team.invite_token}`);
    expect(invite.body.team).toMatchObject({ name: "Zvezdice", tournament_name: "Letnji kup" });
    expect(invite.body.team.invite_token).toBeUndefined();

    expect((await join(player)).status).toBe(200);

    const full = await join(late);
    expect(full.status).toBe(400);
    expect(full.body.message).toMatch(/popunjena/);
  });

  test("igrač ne može u dve ekipe istog turnira", async () => {
    const [organizer, a, b] = [await adminUser(), await createUser(), await createUser()];
    const t = await create(organizer);
    await register(t, a, "Prva");
    const { team } = (await register(t, b, "Druga")).body;

    const res = await api.post(`/api/tournaments/invite/${team.invite_token}/join`).set(auth(a));
    const second = await register(t, a, "Treća");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Već si u jednoj ekipi/);
    expect(second.status).toBe(400);
  });

  test("naziv ekipe je jedinstven, a neispravan link ne radi", async () => {
    const [organizer, a, b] = [await adminUser(), await createUser(), await createUser()];
    const t = await create(organizer);
    await register(t, a, "Zvezdice");

    const res = await register(t, b, "ZVEZDICE");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nazivom već postoji/);
    expect((await api.get("/api/tournaments/invite/nema")).status).toBe(404);
  });

  test("popunjen turnir ne prima nove ekipe", async () => {
    const [organizer, a, b, c] = [await adminUser(), await createUser(), await createUser(), await createUser()];
    const t = await create(organizer, { max_teams: 2 });
    await register(t, a, "Prva");
    await register(t, b, "Druga");

    const res = await register(t, c, "Treća");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/popunjen/);
  });

  test("odbijena ekipa oslobađa igrače i naziv", async () => {
    const [organizer, captain] = [await adminUser(), await createUser()];
    const t = await create(organizer);
    const { team } = (await register(t, captain, "Zvezdice")).body;

    await api.post(`/api/tournaments/${t.id}/teams/${team.id}/reject`).set(auth(organizer));

    expect((await details(t, captain)).my_team_id).toBeNull();
    expect((await register(t, captain, "Zvezdice")).status).toBe(201);
  });

  test("igrač napušta ekipu, kapiten odjavljuje celu ekipu", async () => {
    const [organizer, captain, player, other] = [
      await adminUser(),
      await createUser(),
      await createUser(),
      await createUser(),
    ];
    const t = await create(organizer);
    const { team } = (await register(t, captain, "Zvezdice")).body;
    await api.post(`/api/tournaments/invite/${team.invite_token}/join`).set(auth(player));
    const url = `/api/tournaments/${t.id}/teams/${team.id}`;

    expect((await api.delete(`${url}/players/${captain.id}`).set(auth(captain))).status).toBe(400);
    expect((await api.delete(`${url}/players/${player.id}`).set(auth(other))).status).toBe(403);
    expect((await api.delete(`${url}/players/${player.id}`).set(auth(player))).status).toBe(200);
    expect((await api.delete(url).set(auth(other))).status).toBe(403);
    expect((await api.delete(url).set(auth(captain))).status).toBe(200);
    expect((await details(t, organizer)).teams).toHaveLength(0);
  });

  test("organizator beleži kotizaciju, drugi ne mogu", async () => {
    const [organizer, user] = [await adminUser(), await createUser()];
    const t = await create(organizer);
    const [team] = await approvedTeams(t, organizer, 1);
    const url = `/api/tournaments/${t.id}/teams/${team.id}/paid`;

    expect((await api.put(url).set(auth(user)).send({ paid: true })).status).toBe(403);

    await api.put(url).set(auth(organizer)).send({ paid: true });

    expect((await details(t)).teams[0].paid).toBe(true);
  });

  test("samo organizator potvrđuje ekipe", async () => {
    const [organizer, captain] = [await adminUser(), await createUser()];
    const t = await create(organizer);
    const { team } = (await register(t, captain, "Zvezdice")).body;

    const res = await api.post(`/api/tournaments/${t.id}/teams/${team.id}/approve`).set(auth(captain));

    expect(res.status).toBe(403);
  });
});

describe("tok turnira", () => {
  test("za početak trebaju 2 potvrđene ekipe; ekipe na čekanju se odbijaju", async () => {
    const [organizer, pending] = [await adminUser(), await createUser()];
    const t = await create(organizer);
    await approvedTeams(t, organizer, 1);

    expect((await start(t, organizer)).status).toBe(400);

    await approvedTeams(t, organizer, 0);
    const second = await createUser();
    const { team } = (await register(t, second, "Druga")).body;
    await api.post(`/api/tournaments/${t.id}/teams/${team.id}/approve`).set(auth(organizer));
    await register(t, pending, "Kasni");

    const res = await start(t, organizer);

    expect(res.status).toBe(200);
    const page = await details(t, organizer);
    expect(page.tournament.status).toBe("in_progress");
    expect(page.games).toHaveLength(1);
    expect(page.teams.find((x) => x.name === "Kasni").status).toBe("rejected");
    expect((await messagesOf(second)).pop().message).toMatch(/je počeo/);
  });

  test("posle početka nema prijava ni ponovnog početka", async () => {
    const [organizer, late] = [await adminUser(), await createUser()];
    const t = await create(organizer);
    await approvedTeams(t, organizer, 2);
    await start(t, organizer);

    expect((await register(t, late, "Kasni")).status).toBe(400);
    expect((await start(t, organizer)).status).toBe(400);
  });

  test("liga: tabela se računa, a posle poslednje utakmice je poznat pobednik", async () => {
    const organizer = await adminUser();
    const t = await create(organizer);
    const teams = await approvedTeams(t, organizer, 3);
    await start(t, organizer);

    const { games } = await details(t);
    expect(games).toHaveLength(3);

    await result(t, games[0], organizer, 2, 1);
    let page = await details(t);
    expect(page.tournament.status).toBe("in_progress");
    expect(page.standings[0]).toMatchObject({ points: 3, played: 1 });

    await result(t, games[1], organizer, 0, 0);
    await result(t, games[2], organizer, 3, 0);

    page = await details(t);
    expect(page.tournament.status).toBe("finished");
    expect(page.tournament.winner_name).toBe(page.standings[0].name);
    expect((await messagesOf(teams[0].captain)).pop().message).toMatch(/je završen\. Pobednik/);
  });

  test("ispravka rezultata posle kraja menja pobednika bez nove notifikacije", async () => {
    const organizer = await adminUser();
    const t = await create(organizer);
    const teams = await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;

    await result(t, game, organizer, 2, 0);
    const before = (await messagesOf(teams[0].captain)).length;
    await result(t, game, organizer, 0, 2);

    const page = await details(t);
    expect(page.tournament.winner_team_id).toBe(game.team_b_id);
    expect(await messagesOf(teams[0].captain)).toHaveLength(before);
  });

  test("kup: pobednik ide dalje, finale određuje pobednika turnira", async () => {
    const organizer = await adminUser();
    const t = await create(organizer, { format: "knockout" });
    await approvedTeams(t, organizer, 4);
    await start(t, organizer);

    let { games } = await details(t);
    expect(games).toHaveLength(3);

    await result(t, games[0], organizer, 3, 1);
    await result(t, games[1], organizer, 1, 1, { penalties_a: 3, penalties_b: 5 });

    ({ games } = await details(t));
    expect(games[2].team_a_id).toBe(games[0].team_a_id);
    expect(games[2].team_b_id).toBe(games[1].team_b_id);
    expect(games[1]).toMatchObject({ penalties_a: 3, penalties_b: 5 });

    await result(t, games[2], organizer, 2, 0);

    const page = await details(t);
    expect(page.tournament.status).toBe("finished");
    expect(page.tournament.winner_team_id).toBe(games[0].team_a_id);
  });

  test("kup sa 3 ekipe: slobodan prolaz ne čeka rezultat", async () => {
    const organizer = await adminUser();
    const t = await create(organizer, { format: "knockout" });
    await approvedTeams(t, organizer, 3);
    await start(t, organizer);

    const { games } = await details(t);
    const bye = games[0];

    expect(bye.team_b_id).toBeNull();
    expect(games[2].team_a_id).toBe(bye.team_a_id);
    expect((await result(t, bye, organizer, 1, 0)).status).toBe(400);

    await result(t, games[1], organizer, 1, 0);
    await result(t, (await details(t)).games[2], organizer, 1, 0);

    expect((await details(t)).tournament.status).toBe("finished");
  });

  test("kup: pobednik ne može da se promeni ako je sledeća utakmica odigrana", async () => {
    const organizer = await adminUser();
    const t = await create(organizer, { format: "knockout" });
    await approvedTeams(t, organizer, 4);
    await start(t, organizer);
    const { games } = await details(t);

    await result(t, games[0], organizer, 2, 0);

    // Ispravka pre sledeće utakmice menja ekipu u sledećem kolu
    await result(t, games[0], organizer, 0, 2);
    expect((await details(t)).games[2].team_a_id).toBe(games[0].team_b_id);

    await result(t, games[1], organizer, 1, 0);
    await result(t, (await details(t)).games[2], organizer, 1, 0);

    const res = await result(t, games[0], organizer, 3, 0);
    const sameWinner = await result(t, games[0], organizer, 0, 5);

    expect(res.status).toBe(400);
    expect(sameWinner.status).toBe(200);
  });

  test("rezultat upisuje samo organizator, i proverava pravila sporta", async () => {
    const [organizer, user] = [await adminUser(), await createUser()];
    const t = await create(organizer, { sport: "Košarka" });
    await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;

    expect((await result(t, game, user, 80, 70)).status).toBe(403);

    const draw = await result(t, game, organizer, 80, 80);
    expect(draw.status).toBe(400);
    expect(draw.body.message).toMatch(/nema nerešenog/);
  });

  test("kup ne prima rezultat za utakmicu bez obe ekipe", async () => {
    const organizer = await adminUser();
    const t = await create(organizer, { format: "knockout" });
    await approvedTeams(t, organizer, 4);
    await start(t, organizer);
    const { games } = await details(t);

    const res = await result(t, games[2], organizer, 1, 0);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/obe ekipe/);
  });
});

describe("parovi iz žreba održanog van aplikacije", () => {
  const startWith = (t, organizer, pairs) =>
    api.post(`/api/tournaments/${t.id}/start`).set(auth(organizer)).send({ pairs });

  test("validatePairs: svaka ekipa tačno jednom, tačan broj parova", () => {
    expect(validatePairs([[1, 2], [3, 4]], [1, 2, 3, 4])).toEqual([[1, 2], [3, 4]]);
    // Slobodan prolaz može biti bilo gde, i sa bilo koje strane para
    expect(validatePairs([[1, 2], [null, 3]], [1, 2, 3])).toEqual([[1, 2], [3, null]]);
    expect(validatePairs([[1, 2], [3, 3]], [1, 2, 3, 4])).toBeNull();
    expect(validatePairs([[1, 2], [3, 9]], [1, 2, 3, 4])).toBeNull();
    expect(validatePairs([[1, 2]], [1, 2, 3, 4])).toBeNull();
    expect(validatePairs([[1, 2], [null, null]], [1, 2])).toBeNull();
  });

  test("16 ekipa: kostur ide tačno po žrebu", async () => {
    const organizer = await adminUser();
    const t = await create(organizer, { format: "knockout", sport: "Odbojka", max_teams: 16 });
    const teams = await approvedTeams(t, organizer, 16);
    // Žreb: 16-1, 15-2, 14-3 ...
    const pairs = Array.from({ length: 8 }, (_, i) => [teams[15 - i].id, teams[i].id]);

    const res = await startWith(t, organizer, pairs);

    expect(res.status).toBe(200);

    const { games } = await details(t);
    const first = games.filter((g) => g.round === 1).sort((a, b) => a.position - b.position);

    expect(games).toHaveLength(15);
    expect(first.map((g) => [g.team_a_id, g.team_b_id])).toEqual(pairs);
  });

  test("slobodan prolaz tamo gde je izvučen ide odmah dalje", async () => {
    const organizer = await adminUser();
    const t = await create(organizer, { format: "knockout" });
    const [a, b, c] = await approvedTeams(t, organizer, 3);

    expect((await startWith(t, organizer, [[a.id, b.id], [null, c.id]])).status).toBe(200);

    const { games } = await details(t);
    const final = games.find((g) => g.round === 2);

    expect(final.team_b_id).toBe(c.id);
    expect(final.team_a_id).toBeNull();
  });

  test("neispravan žreb ili liga: greška i turnir ne počinje", async () => {
    const organizer = await adminUser();
    const cup = await create(organizer, { format: "knockout" });
    const [a, b, c, d] = await approvedTeams(cup, organizer, 4);

    const twice = await startWith(cup, organizer, [[a.id, b.id], [a.id, c.id]]);

    expect(twice.status).toBe(400);
    expect(twice.body.message).toBe(
      "Parovi iz žreba nisu ispravni: broj parova mora biti 2, a svaka potvrđena ekipa tačno jednom."
    );
    expect((await details(cup)).tournament.status).toBe("registration");
    expect((await startWith(cup, organizer, [[a.id, b.id], [c.id, d.id]])).status).toBe(200);

    const league = await create(organizer);
    const [x, y] = await approvedTeams(league, organizer, 2);
    expect((await startWith(league, organizer, [[x.id, y.id]])).status).toBe(400);
  });
});

describe("raspored na terenu i otkazivanje", () => {
  const bookableVenue = async (owner) => {
    const venue = await createVenue({ name: "SC Sunce" });
    await pool.query(
      `UPDATE venues SET owner_id = $2, accepts_reservations = true,
              reservation_open_hour = 8, reservation_close_hour = 23
       WHERE id = $1`,
      [venue.id, owner.id]
    );

    return venue;
  };

  const schedule = (t, game, user, date, time) =>
    api
      .put(`/api/tournaments/${t.id}/games/${game.id}/schedule`)
      .set(auth(user))
      .send({ game_date: date, game_time: time });

  const reservations = async () =>
    (await pool.query("SELECT status, start_hour, user_id FROM venue_reservations ORDER BY id")).rows;

  test("vreme utakmice bez terena samo se upisuje i javlja ekipama", async () => {
    const organizer = await adminUser();
    const t = await create(organizer);
    const teams = await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;

    const res = await schedule(t, game, organizer, dateIn(5), "18:30");

    expect(res.status).toBe(200);
    expect((await details(t)).games[0].game_time).toBe("18:30:00");
    expect((await messagesOf(teams[0].captain)).pop().message).toMatch(/utakmica tvoje ekipe/);
    expect(await reservations()).toHaveLength(0);
  });

  test("na terenu koji prima rezervacije utakmica šalje zahtev vlasniku", async () => {
    const [owner, organizer] = [await createUser(), await adminUser()];
    const venue = await bookableVenue(owner);
    const t = await create(organizer, { venue_id: venue.id });
    await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;

    const res = await schedule(t, game, organizer, dateIn(5), "18:00");

    expect(res.status).toBe(200);
    expect((await reservations())[0]).toMatchObject({ status: "pending", start_hour: 18 });
    expect((await details(t)).games[0].reservation_status).toBe("pending");
    expect((await messagesOf(owner))[0].message).toMatch(/Nov zahtev za rezervaciju/);
  });

  test("zauzeto vreme i vreme koje nije pun sat se odbijaju", async () => {
    const [owner, organizer, player] = [await createUser(), await adminUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const t = await create(organizer, { venue_id: venue.id });
    await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;
    await api
      .post(`/api/venues/${venue.id}/reservations`)
      .set(auth(player))
      .send({ date: dateIn(5), start_hour: 18, hours: 1 });

    expect((await schedule(t, game, organizer, dateIn(5), "18:00")).status).toBe(409);
    expect((await schedule(t, game, organizer, dateIn(5), "19:30")).status).toBe(400);
  });

  test("promena vremena otkazuje staru rezervaciju", async () => {
    const [owner, organizer] = [await createUser(), await adminUser()];
    const venue = await bookableVenue(owner);
    const t = await create(organizer, { venue_id: venue.id });
    await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;

    await schedule(t, game, organizer, dateIn(5), "18:00");
    await schedule(t, game, organizer, dateIn(5), "20:00");

    expect((await reservations()).map((r) => r.status)).toEqual(["cancelled", "pending"]);
  });

  const scheduleRound = (t, round, user, date, time, interval) =>
    api
      .put(`/api/tournaments/${t.id}/rounds/${round}/schedule`)
      .set(auth(user))
      .send({ game_date: date, start_time: time, interval });

  test("celo kolo odjednom: utakmice redom na razmak, slobodan prolaz se preskače", async () => {
    const [organizer, player] = [await adminUser(), await createUser()];
    const t = await create(organizer, { format: "knockout" });
    await approvedTeams(t, organizer, 6);
    await start(t, organizer);

    // 6 ekipa: dva slobodna prolaza i dve utakmice u 1. kolu
    const res = await scheduleRound(t, 1, organizer, dateIn(5), "17:00", 90);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Zakazane su utakmice kola: 2.");

    const first = (await details(t)).games.filter((g) => g.round === 1).sort((a, b) => a.position - b.position);

    expect(first.map((g) => g.game_time)).toEqual([null, null, "17:00:00", "18:30:00"]);

    // Polufinale (ekipe još nisu poznate) može da se zakaže unapred, za drugi dan
    expect((await scheduleRound(t, 2, organizer, dateIn(6), "18:00")).status).toBe(200);
    expect((await scheduleRound(t, 2, player, dateIn(6), "18:00")).status).toBe(403);
  });

  test("kolo koje ne staje u dan, pogrešan razmak i zauzet teren", async () => {
    const [owner, organizer, player] = [await createUser(), await adminUser(), await createUser()];
    const venue = await bookableVenue(owner);
    const t = await create(organizer, { venue_id: venue.id, format: "knockout" });
    await approvedTeams(t, organizer, 8);
    await start(t, organizer);

    expect((await scheduleRound(t, 1, organizer, dateIn(5), "22:00")).status).toBe(400);
    expect((await scheduleRound(t, 1, organizer, dateIn(5), "18:00", 50)).status).toBe(400);

    // Treća utakmica (20h) je zauzeta: ništa iz kola se ne zakazuje
    await api
      .post(`/api/venues/${venue.id}/reservations`)
      .set(auth(player))
      .send({ date: dateIn(5), start_hour: 20, hours: 1 });

    expect((await scheduleRound(t, 1, organizer, dateIn(5), "18:00")).status).toBe(409);
    expect((await details(t)).games.every((g) => g.game_time === null)).toBe(true);
    expect((await reservations()).filter((r) => r.status === "pending")).toHaveLength(1);

    expect((await scheduleRound(t, 1, organizer, dateIn(6), "18:00")).status).toBe(200);
    expect((await reservations()).filter((r) => r.status === "pending")).toHaveLength(5);
  });

  test("otkazivanje turnira oslobađa teren i javlja ekipama", async () => {
    const [owner, organizer] = [await createUser(), await adminUser()];
    const venue = await bookableVenue(owner);
    const t = await create(organizer, { venue_id: venue.id });
    const teams = await approvedTeams(t, organizer, 2);
    await start(t, organizer);
    const [game] = (await details(t)).games;
    await schedule(t, game, organizer, dateIn(5), "18:00");

    const res = await api.post(`/api/tournaments/${t.id}/cancel`).set(auth(organizer));

    expect(res.status).toBe(200);
    expect((await reservations())[0].status).toBe("cancelled");
    expect((await messagesOf(teams[0].captain)).pop().message).toMatch(/je otkazan/);
    expect((await messagesOf(owner)).pop().message).toMatch(/rezervacije terena su oslobođene/);
    expect((await api.post(`/api/tournaments/${t.id}/cancel`).set(auth(organizer))).status).toBe(400);
  });

  test("samo organizator otkazuje turnir", async () => {
    const [organizer, user] = [await adminUser(), await createUser()];
    const t = await create(organizer);

    expect((await api.post(`/api/tournaments/${t.id}/cancel`).set(auth(user))).status).toBe(403);
  });
});
