import {
  localDateKey,
  matchStart,
  isPastMatch,
  normalizeText,
  todayKey,
  maxDateKey,
  inConfirmWindow,
} from "./matchDate";

// Termin od 10. 8. 2026. kako ga baza vraća: lokalna ponoć zapisana u UTC-u
const localMidnight = (y, m, d) => new Date(y, m - 1, d).toISOString();

describe("localDateKey", () => {
  test("vraća lokalni datum, ne UTC (greška sa .slice(0, 10))", () => {
    expect(localDateKey(localMidnight(2026, 8, 10))).toBe("2026-08-10");
  });

  test("dodaje nule ispred meseca i dana", () => {
    expect(localDateKey(localMidnight(2027, 1, 5))).toBe("2027-01-05");
  });
});

describe("matchStart i isPastMatch", () => {
  test("spaja datum i vreme termina", () => {
    const start = matchStart(localMidnight(2026, 8, 10), "20:30:00");

    expect(start.getHours()).toBe(20);
    expect(start.getMinutes()).toBe(30);
    expect(start.getDate()).toBe(10);
  });

  test("termin od pre sat vremena je odigran, sutrašnji nije", () => {
    const hourAgo = new Date(Date.now() - 3600 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const time = (d) => `${d.getHours()}:${d.getMinutes()}:00`;
    const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

    expect(isPastMatch(day(hourAgo), time(hourAgo))).toBe(true);
    expect(isPastMatch(day(tomorrow), time(tomorrow))).toBe(false);
  });
});

describe("inConfirmWindow (poslednja 24 h pred termin)", () => {
  const at = (hoursFromNow) => {
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

    return [day, `${d.getHours()}:${d.getMinutes()}:00`];
  };

  test.each([
    [20, true],
    [2, true],
    [30, false],
    [-1, false],
  ])("termin za %s h -> %s", (hours, expected) => {
    expect(inConfirmWindow(...at(hours))).toBe(expected);
  });
});

describe("granice za izbor datuma", () => {
  test("max je tačno godinu dana posle danas", () => {
    const [y, m, d] = todayKey().split("-");

    expect(maxDateKey()).toBe(`${Number(y) + 1}-${m}-${d}`);
  });
});

describe("normalizeText", () => {
  test.each([
    ["Košarka", "kosarka"],
    ["ČAČAK", "cacak"],
    ["Ćuprija", "cuprija"],
    ["Žabalj", "zabalj"],
    ["Đakovica", "djakovica"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  test("prazan unos ne puca", () => {
    expect(normalizeText(undefined)).toBe("");
  });
});
