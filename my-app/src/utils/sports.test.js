import { SPORTS, defaultPlayers, sportEmoji, sportFilters, sportOption } from "./sports";
import { changeLanguage } from "../i18n";

test("svaki sport ima svoju ikonicu", () => {
  expect(SPORTS.map((s) => sportEmoji(s.value))).toEqual(["⚽", "🏀", "🎾", "🏐"]);
});

test("predlog broja igrača zavisi od sporta", () => {
  expect(defaultPlayers("Tenis")).toBe(2);
  expect(defaultPlayers("Odbojka")).toBe(12);
  expect(defaultPlayers("Fudbal")).toBe(10);
});

test("nazivi sportova prate jezik, a vrednost filtera ostaje ista", async () => {
  await changeLanguage("en");

  expect(sportOption("Odbojka")).toBe("🏐 Volleyball");
  expect(sportFilters("").map((f) => f.value)).toEqual(["", "Fudbal", "Košarka", "Tenis", "Odbojka"]);

  await changeLanguage("sr");

  expect(sportOption("Tenis")).toBe("🎾 Tenis");
});
