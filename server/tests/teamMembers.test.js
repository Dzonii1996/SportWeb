const { api, pool, resetDb, createUser, auth, dateIn, makeAdmin } = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

// Školski turnir: kapiten (nastavnik) upisuje učenike koji nemaju nalog

const setup = async ({ maxRoster = 4 } = {}) => {
  const organizer = await createUser();
  await makeAdmin(organizer);
  const captain = await createUser();

  const t = (
    await api.post("/api/tournaments").set(auth(organizer)).send({
      name: "Školski kup",
      sport: "Odbojka",
      format: "knockout",
      location: "Školska sala",
      start_date: dateIn(5),
      max_teams: 8,
      max_roster: maxRoster,
    })
  ).body.tournament;

  const { team } = (
    await api.post(`/api/tournaments/${t.id}/teams`).set(auth(captain)).send({ name: "OŠ Vuk 8/2" })
  ).body;

  return { organizer, captain, t, team, url: `/api/tournaments/${t.id}/teams/${team.id}/members` };
};

const details = async (t, user) => {
  const req = api.get(`/api/tournaments/${t.id}`);

  return (await (user ? req.set(auth(user)) : req)).body;
};

describe("igrači bez naloga", () => {
  test("kapiten upisuje učenika sa brojem i razredom, ime se sređuje", async () => {
    const { captain, t, url } = await setup();

    const res = await api
      .post(url)
      .set(auth(captain))
      .send({ name: "  Marko   Petrović ", jersey_number: "7", grade: " 8/2 " });

    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({ name: "Marko Petrović", jersey_number: 7, grade: "8/2" });

    const team = (await details(t, captain)).teams[0];

    expect(team.members).toEqual([res.body.member]);
    expect(team.members_count).toBe(1);
  });

  test("broj i razred nisu obavezni, a pogrešni podaci se odbijaju", async () => {
    const { captain, url } = await setup();

    expect((await api.post(url).set(auth(captain)).send({ name: "Ana" })).status).toBe(201);
    expect((await api.post(url).set(auth(captain)).send({ name: "A" })).status).toBe(400);
    expect((await api.post(url).set(auth(captain)).send({ name: "Ivan", jersey_number: 100 })).status).toBe(400);
    expect((await api.post(url).set(auth(captain)).send({ name: "Ivan", jersey_number: 2.5 })).status).toBe(400);
    expect((await api.post(url).set(auth(captain)).send({ name: "Ivan", grade: "x".repeat(21) })).status).toBe(400);
  });

  test("upisani igrači i igrači sa nalogom zajedno pune sastav", async () => {
    // Kapiten je već u sastavu, pa ostaju 3 mesta
    const { captain, team, url } = await setup({ maxRoster: 4 });

    for (const name of ["Ana", "Bojan", "Ceca"]) {
      expect((await api.post(url).set(auth(captain)).send({ name })).status).toBe(201);
    }

    expect((await api.post(url).set(auth(captain)).send({ name: "Dejan" })).status).toBe(400);

    const late = await createUser();
    const join = await api.post(`/api/tournaments/invite/${team.invite_token}/join`).set(auth(late));

    expect(join.status).toBe(400);
  });

  test("organizator može da menja sastav, drugi ne mogu", async () => {
    const { organizer, captain, url } = await setup();
    const stranger = await createUser();

    expect((await api.post(url).set(auth(stranger)).send({ name: "Uljez" })).status).toBe(403);

    const { member } = (await api.post(url).set(auth(organizer)).send({ name: "Jelena" })).body;

    expect((await api.put(`${url}/${member.id}`).set(auth(stranger)).send({ name: "X y" })).status).toBe(403);
    expect((await api.delete(`${url}/${member.id}`).set(auth(stranger))).status).toBe(403);

    const edited = await api
      .put(`${url}/${member.id}`)
      .set(auth(captain))
      .send({ name: "Jelena Jović", jersey_number: 10, grade: "" });

    expect(edited.status).toBe(200);
    expect(edited.body.member).toMatchObject({ name: "Jelena Jović", jersey_number: 10, grade: null });

    expect((await api.delete(`${url}/${member.id}`).set(auth(captain))).status).toBe(200);
    expect((await api.delete(`${url}/${member.id}`).set(auth(captain))).status).toBe(404);
  });

  test("igrač druge ekipe ne može da se menja preko ove ekipe", async () => {
    const { captain, t, url } = await setup();
    const other = await createUser();
    const { team: otherTeam } = (
      await api.post(`/api/tournaments/${t.id}/teams`).set(auth(other)).send({ name: "OŠ Njegoš" })
    ).body;
    const { member } = (
      await api.post(`/api/tournaments/${t.id}/teams/${otherTeam.id}/members`).set(auth(other)).send({ name: "Tuđi" })
    ).body;

    expect((await api.delete(`${url}/${member.id}`).set(auth(captain))).status).toBe(404);
  });

  test("imena učenika vide samo organizator i ekipa, ostali samo broj", async () => {
    const { organizer, captain, t, team, url } = await setup();
    await api.post(url).set(auth(captain)).send({ name: "Mila" });
    await api.post(`/api/tournaments/${t.id}/teams/${team.id}/approve`).set(auth(organizer));

    const visitor = await createUser();

    for (const user of [null, visitor]) {
      const shown = (await details(t, user)).teams[0];

      expect(shown.members).toEqual([]);
      expect(shown.members_count).toBe(1);
    }

    expect((await details(t, organizer)).teams[0].members).toHaveLength(1);
  });

  test("sastav se menja i dok traje turnir, a posle kraja ili otkazivanja ne", async () => {
    const { organizer, captain, t, url } = await setup();

    expect((await api.post(`/api/tournaments/${t.id}/cancel`).set(auth(organizer))).status).toBe(200);
    expect((await api.post(url).set(auth(captain)).send({ name: "Kasno" })).status).toBe(400);
  });
});
