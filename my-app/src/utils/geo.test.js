import { distanceKm, formatDistance, hasCoords } from "./geo";

describe("distanceKm", () => {
  test("ista tačka je 0 km", () => {
    expect(distanceKm(42.89, 20.87, 42.89, 20.87)).toBe(0);
  });

  test("Kosovska Mitrovica – Beograd je oko 210 km vazdušnom linijom", () => {
    const km = distanceKm(42.8914, 20.866, 44.7866, 20.4489);

    expect(km).toBeGreaterThan(205);
    expect(km).toBeLessThan(215);
  });

  test("0,01° geografske širine je oko 1,1 km", () => {
    expect(distanceKm(42.89, 20.87, 42.9, 20.87)).toBeCloseTo(1.11, 1);
  });
});

describe("formatDistance", () => {
  test("ispod 1 km prikazuje metre", () => {
    expect(formatDistance(0.35)).toBe("350 m");
  });

  test("iznad 1 km prikazuje km sa jednom decimalom", () => {
    expect(formatDistance(1.234)).toBe("1.2 km");
  });
});

describe("hasCoords", () => {
  test.each([
    [{ latitude: 42.9, longitude: 20.8 }, true],
    [{ latitude: 0, longitude: 0 }, true],
    [{ latitude: null, longitude: null }, false],
    [{}, false],
    [null, false],
  ])("%j -> %s", (match, expected) => {
    expect(hasCoords(match)).toBe(expected);
  });
});
