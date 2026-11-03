const {
  api,
  pool,
  resetDb,
  createUser,
  auth,
  createMatch,
  addPlayers,
  makeAdmin,
  createVenue,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const rate = (venue, user, body) =>
  api.put(`/api/venues/${venue.id}/reviews`).set(auth(user)).send(body);

const reviewsOf = (venue, user) => {
  const req = api.get(`/api/venues/${venue.id}/reviews`);

  return user ? req.set(auth(user)) : req;
};

describe("ocenjivanje terena", () => {
  test("korisnik ocenjuje teren i ocena se vidi u proseku", async () => {
    const [a, b] = [await createUser(), await createUser()];
    const venue = await createVenue();

    const first = await rate(venue, a, { rating: 5, comment: "  Odlična podloga.  " });
    await rate(venue, b, { rating: 4 });

    expect(first.status).toBe(201);
    expect(first.body.review).toMatchObject({ rating: 5, comment: "Odlična podloga." });

    const list = await api.get("/api/venues");
    expect(list.body.venues[0]).toMatchObject({ rating_avg: 4.5, rating_count: 2 });

    const one = await api.get(`/api/venues/${venue.id}`);
    expect(one.body.venue).toMatchObject({ rating_avg: 4.5, rating_count: 2 });
  });

  test("teren bez ocena nema prosek", async () => {
    await createVenue();

    const list = await api.get("/api/venues");

    expect(list.body.venues[0]).toMatchObject({ rating_avg: null, rating_count: 0 });
  });

  test("ponovna ocena menja postojeću umesto da pravi novu", async () => {
    const user = await createUser();
    const venue = await createVenue();

    await rate(venue, user, { rating: 2, comment: "Loše" });
    const again = await rate(venue, user, { rating: 4, comment: "" });

    expect(again.status).toBe(200);
    expect(again.body.review).toMatchObject({ rating: 4, comment: null });

    const count = await pool.query("SELECT COUNT(*)::int AS n FROM venue_reviews");
    expect(count.rows[0].n).toBe(1);
  });

  test("bez prijave nema ocenjivanja", async () => {
    const venue = await createVenue();

    const res = await api.put(`/api/venues/${venue.id}/reviews`).send({ rating: 5 });

    expect(res.status).toBe(401);
  });

  test("neodobren teren ne može da se oceni", async () => {
    const user = await createUser();
    const pending = await createVenue({ status: "pending", suggestedBy: user });

    const res = await rate(pending, user, { rating: 5 });

    expect(res.status).toBe(404);
  });

  test.each([[0], [6], [3.5], ["pet"], [null]])("neispravna ocena %p je odbijena", async (rating) => {
    const user = await createUser();
    const venue = await createVenue();

    const res = await rate(venue, user, { rating });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/od 1 do 5/);
  });

  test("predugačak komentar je odbijen", async () => {
    const user = await createUser();
    const venue = await createVenue();

    const res = await rate(venue, user, { rating: 3, comment: "a".repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Komentar/);
  });
});

describe("lista ocena", () => {
  test("vraća ocene, raspodelu po zvezdicama i moju ocenu", async () => {
    const [me, other] = [await createUser("Ja"), await createUser("Drugi")];
    const venue = await createVenue();
    await rate(venue, other, { rating: 3, comment: "Može" });
    await rate(venue, me, { rating: 5 });

    const asMe = await reviewsOf(venue, me);
    const anonymous = await reviewsOf(venue);

    expect(asMe.body.reviews.map((r) => r.user_name)).toEqual(["Ja", "Drugi"]);
    expect(asMe.body.my_review).toMatchObject({ rating: 5, user_name: "Ja" });
    expect(asMe.body.distribution).toEqual([
      { stars: 5, count: 1 },
      { stars: 4, count: 0 },
      { stars: 3, count: 1 },
      { stars: 2, count: 0 },
      { stars: 1, count: 0 },
    ]);
    expect(asMe.body.can_moderate).toBe(false);
    expect(anonymous.body.my_review).toBeNull();
  });

  test("označava ko je igrao odigran termin na terenu", async () => {
    const [creator, player, stranger, future] = [
      await createUser(),
      await createUser(),
      await createUser(),
      await createUser(),
    ];
    const venue = await createVenue();
    const played = await createMatch(creator, { startsInHours: -3 });
    const upcoming = await createMatch(creator);
    await pool.query("UPDATE matches SET venue_id = $1", [venue.id]);
    await addPlayers(played, [player]);
    await addPlayers(upcoming, [future]);

    for (const user of [creator, player, stranger, future]) {
      await rate(venue, user, { rating: 4 });
    }

    const res = await reviewsOf(venue);
    const playedHere = Object.fromEntries(res.body.reviews.map((r) => [r.user_id, r.played_here]));

    expect(playedHere).toEqual({
      [creator.id]: true,
      [player.id]: true,
      [stranger.id]: false,
      [future.id]: false,
    });
  });

  test("ocene neodobrenog terena se ne vide", async () => {
    const venue = await createVenue({ status: "rejected" });

    const res = await reviewsOf(venue);

    expect(res.status).toBe(404);
  });
});

describe("brisanje ocene", () => {
  test("autor briše svoju ocenu, drugi ne mogu", async () => {
    const [author, other] = [await createUser(), await createUser()];
    const venue = await createVenue();
    const { review } = (await rate(venue, author, { rating: 1 })).body;

    const byOther = await api.delete(`/api/venues/${venue.id}/reviews/${review.id}`).set(auth(other));
    const byAuthor = await api.delete(`/api/venues/${venue.id}/reviews/${review.id}`).set(auth(author));

    expect(byOther.status).toBe(403);
    expect(byAuthor.status).toBe(200);
    expect((await reviewsOf(venue)).body.reviews).toHaveLength(0);
  });

  test("admin briše tuđu ocenu", async () => {
    const [admin, author] = [await createUser(), await createUser()];
    await makeAdmin(admin);
    const venue = await createVenue();
    const { review } = (await rate(venue, author, { rating: 1, comment: "uvreda" })).body;

    expect((await reviewsOf(venue, admin)).body.can_moderate).toBe(true);

    const res = await api.delete(`/api/venues/${venue.id}/reviews/${review.id}`).set(auth(admin));

    expect(res.status).toBe(200);
  });

  test("ocena drugog terena ne može da se obriše preko pogrešnog terena", async () => {
    const author = await createUser();
    const [first, second] = [await createVenue(), await createVenue({ name: "Drugi" })];
    const { review } = (await rate(first, author, { rating: 3 })).body;

    const res = await api.delete(`/api/venues/${second.id}/reviews/${review.id}`).set(auth(author));

    expect(res.status).toBe(404);
  });
});

describe("filter po oceni", () => {
  test("min_rating prikazuje samo terene sa dovoljno dobrom ocenom", async () => {
    const [a, b] = [await createUser(), await createUser()];
    const good = await createVenue({ name: "Dobar" });
    const ok = await createVenue({ name: "Prosečan" });
    await createVenue({ name: "Bez ocena" });
    await rate(good, a, { rating: 5 });
    await rate(good, b, { rating: 4 });
    await rate(ok, a, { rating: 3 });

    const names = async (q) => (await api.get(`/api/venues${q}`)).body.venues.map((v) => v.name);

    expect(await names("?min_rating=4")).toEqual(["Dobar"]);
    expect(await names("?min_rating=3")).toEqual(["Dobar", "Prosečan"]);
    expect((await api.get("/api/venues?min_rating=9")).status).toBe(400);
  });
});
