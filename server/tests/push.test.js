jest.mock("web-push", () => ({ sendNotification: jest.fn() }));

const webpush = require("web-push");
const { afterCommit } = require("../database/db");
const { api, pool, resetDb, createUser, auth, createMatch, addPlayers } = require("./helpers");

beforeEach(async () => {
  await resetDb();
  webpush.sendNotification.mockReset();
  webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
  process.env.VAPID_PUBLIC_KEY = "javni-kljuc";
  process.env.VAPID_PRIVATE_KEY = "tajni-kljuc";
});

afterAll(() => pool.end());

const subscription = (n = 1) => ({
  endpoint: `https://push.example.com/uredjaj-${n}`,
  keys: { p256dh: `p256dh-${n}`, auth: `auth-${n}` },
});

const subscribe = (user, { n = 1, language = "sr" } = {}) =>
  api.post("/api/notifications/push/subscriptions").set(auth(user)).send({ subscription: subscription(n), language });

const subscriptionsOf = async (user) =>
  (await pool.query("SELECT endpoint, language FROM push_subscriptions WHERE user_id = $1 ORDER BY id", [user.id])).rows;

// Push se šalje u pozadini, posle odgovora servera
const waitForPushes = async (count) => {
  for (let i = 0; i < 50 && webpush.sendNotification.mock.calls.length < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return webpush.sendNotification.mock.calls;
};

const payloadOf = (call) => JSON.parse(call[1]);

describe("pretplata", () => {
  test("javni ključ je dostupan prijavljenom korisniku", async () => {
    const ana = await createUser("Ana");

    const res = await api.get("/api/notifications/push/key").set(auth(ana));

    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe("javni-kljuc");
  });

  test("bez prijave nema pretplate", async () => {
    const res = await api.post("/api/notifications/push/subscriptions").send({ subscription: subscription() });

    expect(res.status).toBe(401);
  });

  test("uređaj se pretplaćuje, a ponovna pretplata samo menja jezik", async () => {
    const ana = await createUser("Ana");

    expect((await subscribe(ana)).status).toBe(200);
    expect((await subscribe(ana, { language: "en" })).status).toBe(200);

    expect(await subscriptionsOf(ana)).toEqual([{ endpoint: subscription().endpoint, language: "en" }]);
  });

  test("isti uređaj prelazi na korisnika koji se poslednji prijavio", async () => {
    const ana = await createUser("Ana");
    const bojan = await createUser("Bojan");

    await subscribe(ana);
    await subscribe(bojan);

    expect(await subscriptionsOf(ana)).toEqual([]);
    expect(await subscriptionsOf(bojan)).toHaveLength(1);
  });

  test("neispravna pretplata se odbija", async () => {
    const ana = await createUser("Ana");

    const res = await api
      .post("/api/notifications/push/subscriptions")
      .set(auth(ana))
      .send({ subscription: { endpoint: "http://nije-https.example.com", keys: { p256dh: "a", auth: "b" } } });

    expect(res.status).toBe(400);
    expect(await subscriptionsOf(ana)).toEqual([]);
  });

  test("bez VAPID ključeva na serveru push nije dostupan", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const ana = await createUser("Ana");

    expect((await subscribe(ana)).status).toBe(503);
  });

  test("korisnik briše samo svoju pretplatu", async () => {
    const ana = await createUser("Ana");
    const bojan = await createUser("Bojan");
    await subscribe(ana);

    await api.delete("/api/notifications/push/subscriptions").set(auth(bojan)).send({ endpoint: subscription().endpoint });
    expect(await subscriptionsOf(ana)).toHaveLength(1);

    await api.delete("/api/notifications/push/subscriptions").set(auth(ana)).send({ endpoint: subscription().endpoint });
    expect(await subscriptionsOf(ana)).toEqual([]);
  });
});

describe("slanje", () => {
  test("prijava na termin šalje push organizatoru, sa linkom na termin", async () => {
    const tina = await createUser("Tina");
    const ana = await createUser("Ana");
    const match = await createMatch(tina);
    await subscribe(tina);

    const res = await api.post(`/api/matches/${match.id}/join`).set(auth(ana));
    expect(res.status).toBe(200);

    const calls = await waitForPushes(1);

    expect(calls).toHaveLength(1);
    expect(calls[0][0].endpoint).toBe(subscription().endpoint);
    expect(payloadOf(calls[0]).url).toBe(`/matches/${match.id}`);
    expect(payloadOf(calls[0]).body).toContain("Ana");
  });

  test("push stiže na jeziku uređaja", async () => {
    const tina = await createUser("Tina");
    const ana = await createUser("Ana");
    const match = await createMatch(tina);
    await addPlayers(match, [ana]);
    await subscribe(tina, { language: "en" });

    await api.post(`/api/matches/${match.id}/messages`).set(auth(ana)).send({ message: "Kasnim 5 minuta" });

    const calls = await waitForPushes(1);
    const [stored] = (await pool.query("SELECT message FROM notifications WHERE user_id = $1", [tina.id])).rows;

    expect(calls).toHaveLength(1);
    expect(payloadOf(calls[0]).body).not.toBe(stored.message);
    expect(payloadOf(calls[0]).body).toMatch(/Football/);
  });

  test("bez pretplate nema slanja", async () => {
    const tina = await createUser("Tina");
    const ana = await createUser("Ana");
    const match = await createMatch(tina);

    await api.post(`/api/matches/${match.id}/join`).set(auth(ana));
    await waitForPushes(1);

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  test("pretplata koje više nema se briše", async () => {
    const tina = await createUser("Tina");
    const ana = await createUser("Ana");
    const match = await createMatch(tina);
    await subscribe(tina);
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));

    await api.post(`/api/matches/${match.id}/join`).set(auth(ana));
    await waitForPushes(1);

    for (let i = 0; i < 50 && (await subscriptionsOf(tina)).length > 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(await subscriptionsOf(tina)).toEqual([]);
  });
});

describe("posle transakcije", () => {
  test("radnja čeka COMMIT, a ROLLBACK je odbacuje", async () => {
    const done = [];
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      afterCommit(client, () => done.push("poništeno"));
      await client.query("ROLLBACK");

      await client.query("BEGIN");
      afterCommit(client, () => done.push("upisano"));
      expect(done).toEqual([]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    await new Promise((resolve) => setImmediate(resolve));
    expect(done).toEqual(["upisano"]);

    afterCommit(pool, () => done.push("odmah"));
    expect(done).toEqual(["upisano", "odmah"]);
  });
});
