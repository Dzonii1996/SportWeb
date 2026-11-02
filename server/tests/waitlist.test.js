const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  dateIn,
  createMatch,
  addPlayers,
  notificationsOf,
  playerIds,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const waitlistIds = async (match) =>
  (await api.get(`/api/matches/${match.id}/waitlist`)).body.waitlist.map((u) => u.id);

// Pun termin sa 2 mesta i dva korisnika na listi čekanja (po redu)
const fullMatchWithWaitlist = async () => {
  const owner = await createUser();
  const [p1, p2, w1, w2] = await Promise.all([1, 2, 3, 4].map(() => createUser()));
  const match = await createMatch(owner, { maxPlayers: 2 });
  await addPlayers(match, [p1, p2]);

  await api.post(`/api/matches/${match.id}/waitlist`).set(auth(w1));
  await api.post(`/api/matches/${match.id}/waitlist`).set(auth(w2));

  return { owner, p1, p2, w1, w2, match };
};

describe("upis na listu čekanja", () => {
  test("ne može dok termin ima slobodnih mesta", async () => {
    const match = await createMatch(await createUser());

    const res = await api
      .post(`/api/matches/${match.id}/waitlist`)
      .set(auth(await createUser()));

    expect(res.body.message).toBe("Termin ima slobodnih mesta, prijavite se direktno.");
  });

  test("redosled je po vremenu upisa", async () => {
    const { match, w1, w2 } = await fullMatchWithWaitlist();

    expect(await waitlistIds(match)).toEqual([w1.id, w2.id]);
  });

  test("igrač i dupli upis su odbijeni", async () => {
    const { match, p1, w1 } = await fullMatchWithWaitlist();

    const asPlayer = await api.post(`/api/matches/${match.id}/waitlist`).set(auth(p1));
    const twice = await api.post(`/api/matches/${match.id}/waitlist`).set(auth(w1));

    expect(asPlayer.body.message).toBe("Već ste prijavljeni na ovaj termin.");
    expect(twice.body.message).toBe("Već ste na listi čekanja.");
  });

  test("izlazak sa liste", async () => {
    const { match, w1, w2 } = await fullMatchWithWaitlist();

    await api.delete(`/api/matches/${match.id}/waitlist`).set(auth(w1));

    expect(await waitlistIds(match)).toEqual([w2.id]);
  });
});

describe("automatsko uskakanje", () => {
  test("kad igrač napusti termin, prvi sa liste uskače i dobija notifikaciju", async () => {
    const { match, p1, p2, w1, w2 } = await fullMatchWithWaitlist();

    await api.delete(`/api/matches/${match.id}/leave`).set(auth(p1));

    expect(await playerIds(match)).toEqual([p2.id, w1.id].sort((a, b) => a - b));
    expect(await waitlistIds(match)).toEqual([w2.id]);

    const notes = await notificationsOf(w1);

    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/^Oslobodilo se mesto!/);
    expect(await notificationsOf(w2)).toHaveLength(0);
  });

  test("kad kreator poveća broj mesta, uskače više njih", async () => {
    const { owner, match, w1, w2 } = await fullMatchWithWaitlist();

    // createMatch pravi termin za 48 h; isti datum i vreme šaljemo nazad
    const start = new Date(Date.now() + 48 * 3600 * 1000);
    const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;

    const res = await api
      .put(`/api/matches/${match.id}`)
      .set(auth(owner))
      .send({ location: "Teren", match_date: dateIn(2), match_time: time, max_players: 4 });

    expect(res.body.success).toBe(true);
    expect(await playerIds(match)).toEqual(expect.arrayContaining([w1.id, w2.id]));
    expect(await waitlistIds(match)).toEqual([]);
  });

  test("direktna prijava briše korisnika sa liste", async () => {
    const { match, p1, w1 } = await fullMatchWithWaitlist();

    // Mesto se oslobodi direktno u bazi (bez uskakanja), pa se w1 sam prijavi
    await pool.query("DELETE FROM match_players WHERE user_id = $1", [p1.id]);
    await api.post(`/api/matches/${match.id}/join`).set(auth(w1));

    expect(await waitlistIds(match)).not.toContain(w1.id);
  });
});
