jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));

const fs = require("fs");
const path = require("path");
const { api, pool, resetDb, createUser, auth } = require("./helpers");
const { sendMail } = require("../utils/mailer");
const { translate, languageOf } = require("../utils/i18n");
const { describeMatch } = require("../utils/notify");

const EN = { "Accept-Language": "en" };

beforeEach(resetDb);

afterAll(() => pool.end());

describe("translate", () => {
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

describe("svaka poruka iz koda ima prevod", () => {
  const sources = ["controllers", "services", "utils", "middleware"].flatMap((dir) =>
    fs
      .readdirSync(path.join(__dirname, "..", dir))
      .filter((file) => file !== "messages.en.js" && file !== "i18n.js")
      .map((file) => path.join(__dirname, "..", dir, file))
  );

  // message: "...", error: "...", new HttpError(400, "..."), badRequest(res, "...")
  const LITERAL =
    /(?:message:\s*|error:\s*|\?\s*|:\s+|HttpError\(\d+,\s*|badRequest\(res,\s*)"([A-ZŠĐČĆŽ][^"\n]* [^"\n]*\.)"/g;

  test.each(sources.map((file) => [path.basename(file), file]))("%s", (name, file) => {
    const code = fs.readFileSync(file, "utf8");
    const missing = [...code.matchAll(LITERAL)]
      .map((m) => m[1])
      .filter((text) => translate(text, "en") === text);

    expect(missing).toEqual([]);
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
