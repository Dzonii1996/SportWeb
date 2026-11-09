jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));

const fs = require("fs");
const path = require("path");
const { api, pool, resetDb, createUser, auth } = require("./helpers");
const { sendMail } = require("../utils/mailer");
const { translate, languageOf, msg, render, toData, fromData } = require("../utils/i18n");
const srCatalog = require("../locales/sr.json");
const enCatalog = require("../locales/en.json");
const { describeMatch } = require("../utils/notify");

const EN = { "Accept-Language": "en" };

beforeEach(resetDb);

afterAll(() => pool.end());

describe("stari tekst iz baze (translate)", () => {
  test("bez engleskog ostaje srpski tekst", () => {
    expect(translate("Termin ne postoji.", "sr")).toBe("Termin ne postoji.");
    expect(translate("Nepoznata poruka", "en")).toBe("Nepoznata poruka");
  });

  test("prevodi poruke sa promenljivim delom", () => {
    expect(translate("Teren može imati najviše 6 slika.", "en")).toBe(
      "A venue can have at most 6 images."
    );
    expect(translate("Telefon može imati najviše 30 znakova.", "en")).toBe(
      "Phone can have at most 30 characters."
    );
  });

  test("prevodi opis termina u notifikaciji", () => {
    const match = {
      sport: "Košarka",
      location: "Hala, Mitrovica",
      match_date: new Date(2026, 10, 10),
      match_time: "18:00:00",
    };

    expect(translate(`❌ Termin je otkazan: ${describeMatch(match)}.`, "en")).toBe(
      "❌ Game cancelled: Basketball, Hala, Mitrovica, 10/11/2026 at 18:00."
    );
  });

  test("duža poruka ima prednost, a uneti tekst ostaje isti", () => {
    expect(
      translate("❌ Rezervacija nije prihvaćena: pet, 20. 11. 2026. od 18 do 20h. Poruka vlasnika: $& zauzeto", "en")
    ).toBe("❌ Your booking wasn't accepted: Fri, 20/11/2026 from 18 to 20h. Owner's message: $& zauzeto");
  });

  test("jezik zahteva", () => {
    expect(languageOf("en-GB,en;q=0.9")).toBe("en");
    expect(languageOf("sr,en;q=0.9")).toBe("sr");
    expect(languageOf(undefined)).toBe("sr");
  });
});

describe("poruke su ključevi", () => {
  const flatten = (catalog, prefix = "") =>
    Object.entries(catalog).flatMap(([key, value]) =>
      typeof value === "object" ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]
    );
  const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const srKeys = new Map(flatten(srCatalog));
  const enKeys = new Map(flatten(enCatalog));

  test("sr i en imaju iste ključeve i iste parametre", () => {
    expect([...enKeys.keys()].sort()).toEqual([...srKeys.keys()].sort());

    const different = [...srKeys].filter(([key, text]) => names(text).join() !== names(enKeys.get(key)).join());

    expect(different).toEqual([]);
  });

  const sources = ["controllers", "services", "utils", "middleware"].flatMap((dir) =>
    fs
      .readdirSync(path.join(__dirname, "..", dir))
      .filter((file) => file !== "i18n.js")
      .map((file) => path.join(__dirname, "..", dir, file))
  );

  // message: "...", error: "...", new HttpError(400, "...") sa rečenicom umesto ključa
  const LITERAL =
    /(?:message:\s*|error:\s*|HttpError\(\d+,\s*)["`]([A-ZŠĐČĆŽ][^"`\n]* [^"`\n]*)["`]/g;

  test.each(sources.map((file) => [path.basename(file), file]))("%s", (name, file) => {
    const code = fs.readFileSync(file, "utf8");
    const literals = [...code.matchAll(LITERAL)].map((m) => m[1]);
    const unknown = [...code.matchAll(/\bmsg\(\s*"([^"]+)"/g)].map((m) => m[1]).filter((key) => !srKeys.has(key));

    expect(literals).toEqual([]);
    expect(unknown).toEqual([]);
  });
});

describe("render", () => {
  test("ključ sa parametrima na oba jezika", () => {
    const message = msg("venue.canHaveAtMostCharacters", { label: "Telefon", n: 30 });

    expect(render(message, "sr")).toBe("Telefon može imati najviše 30 znakova.");
    expect(render(message, "en")).toBe("Phone can have at most 30 characters.");
    expect(String(message)).toBe("Telefon može imati najviše 30 znakova.");
  });

  test("opis termina i uneti tekst", () => {
    const match = {
      sport: "Tenis",
      location: "Klub",
      match_date: new Date(2026, 10, 10),
      match_time: "18:00:00",
    };
    const message = msg("common.yourBookingWasntAcceptedOwners", {
      slot: "pet, 20. 11. 2026. od 18 do 20h",
      note: "$& zauzeto {slot}",
    });

    expect(render(msg("chat.newMessagesInTheGame", { match: describeMatch(match) }), "en")).toBe(
      "💬 New messages in the game chat: Tennis, Klub, 10/11/2026 at 18:00."
    );
    expect(render(message, "en")).toBe(
      "❌ Your booking wasn't accepted: Fri, 20/11/2026 from 18 to 20h. Owner's message: $& zauzeto {slot}"
    );
  });

  test("nepoznat ključ je greška", () => {
    expect(() => msg("nema.takvog")).toThrow();
  });

  test("ugnježdena poruka preživi čuvanje u bazi", () => {
    const message = msg("chat.newMessagesInTheGame", { match: msg("tournament.saved") });
    const back = fromData(JSON.parse(JSON.stringify(toData(message.params))));

    expect(render(msg(message.key, back), "en")).toBe("💬 New messages in the game chat: Saved..");
  });
});

describe("API", () => {
  test("poruka greške prati Accept-Language", async () => {
    const body = { email: "nema@test.rs", password: "lozinka1" };

    const sr = await api.post("/api/auth/login").send(body);
    const en = await api.post("/api/auth/login").set(EN).send(body);

    expect(sr.body.message).toBe("Korisnik ne postoji.");
    expect(en.body.message).toBe("User doesn't exist.");
  });

  test("notifikacije iz baze stižu prevedene, a u bazi ostaju na srpskom", async () => {
    const user = await createUser();

    await pool.query(
      "INSERT INTO notifications(user_id, message) VALUES($1, 'Teren je izmenjen.')",
      [user.id]
    );

    const res = await api.get(`/api/notifications/${user.id}`).set(auth(user)).set(EN);
    const stored = await pool.query("SELECT message FROM notifications");

    expect(res.body.notifications[0].message).toBe("The venue was updated.");
    expect(stored.rows[0].message).toBe("Teren je izmenjen.");
  });

  test("nova notifikacija čuva ključ i prikazuje se na jeziku čitaoca", async () => {
    const user = await createUser();
    const { notifyUsers } = require("../utils/notify");

    await notifyUsers(pool, [user.id], msg("common.yourBookingWasntAccepted", { slot: "pet, 20. 11. 2026. od 18 do 20h" }));

    const en = await api.get(`/api/notifications/${user.id}`).set(auth(user)).set(EN);
    const sr = await api.get(`/api/notifications/${user.id}`).set(auth(user));
    const stored = await pool.query("SELECT message, message_key FROM notifications");

    expect(en.body.notifications[0].message).toBe("❌ Your booking wasn't accepted: Fri, 20/11/2026 from 18 to 20h.");
    expect(sr.body.notifications[0].message).toBe("❌ Rezervacija nije prihvaćena: pet, 20. 11. 2026. od 18 do 20h.");
    expect(en.body.notifications[0]).not.toHaveProperty("message_key");
    expect(stored.rows[0]).toEqual({
      message: "❌ Rezervacija nije prihvaćena: pet, 20. 11. 2026. od 18 do 20h.",
      message_key: "common.yourBookingWasntAccepted",
    });
  });

  test("mejl za novu lozinku je na jeziku zahteva", async () => {
    const user = await createUser("Ana");
    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [user.id]);

    await api.post("/api/auth/forgot-password").set(EN).send({ email: rows[0].email });

    const mail = sendMail.mock.calls.at(-1)[0];

    expect(mail.subject).toBe("SportWeb – new password");
    expect(mail.text).toContain("Hi Ana,");
    expect(mail.text).toContain("reset-password?token=");
  });
});
