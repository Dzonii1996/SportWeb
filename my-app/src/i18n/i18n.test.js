import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import i18n, { changeLanguage, locale, sportLabel, surfaceLabel } from ".";
import sr from "./sr.json";
import en from "./en.json";
import { formatRSD } from "../utils/price";
import { STATUS } from "../utils/reservations";

// Ključevi bez oznake množine, jer srpski ima i oblik "few"
const keysOf = (dict) =>
  Object.entries(dict)
    .flatMap(([ns, group]) =>
      Object.keys(group).map((key) => `${ns}.${key.replace(/_(one|few|other)$/, "")}`)
    )
    .filter((key, i, all) => all.indexOf(key) === i)
    .sort();

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, matches: [] }) })
  );
  localStorage.clear();
});

afterEach(() => act(() => changeLanguage("sr")));

test("oba jezika imaju iste ključeve", () => {
  expect(keysOf(en)).toEqual(keysOf(sr));
});

test("izbor jezika u navigaciji menja sajt i pamti se", async () => {
  render(<App />);

  expect(screen.getByText(/Pronađi ekipu/)).toBeInTheDocument();

  await act(async () => userEvent.click(screen.getByRole("button", { name: "English" })));

  expect(screen.getByText(/Find a team/)).toBeInTheDocument();
  expect(localStorage.getItem("lang")).toBe("en");
  expect(document.documentElement.lang).toBe("en");

  await act(async () => userEvent.click(screen.getByRole("button", { name: "Srpski" })));

  expect(screen.getByText(/Pronađi ekipu/)).toBeInTheDocument();
  expect(localStorage.getItem("lang")).toBe("sr");
});

test("pomoćni tekstovi, iznosi i datumi prate jezik", async () => {
  expect(locale()).toBe("sr-Latn-RS");
  expect(formatRSD(1200)).toBe("1.200 din");
  expect(STATUS.pending.label).toBe("Čeka potvrdu");

  await act(() => changeLanguage("en"));

  expect(locale()).toBe("en-GB");
  expect(formatRSD(1200)).toBe("1,200 RSD");
  expect(STATUS.pending.label).toBe("Awaiting confirmation");
  expect(sportLabel("Košarka")).toBe("Basketball");
  expect(surfaceLabel("Parket")).toBe("Hardwood");
  expect(surfaceLabel("Nepoznato")).toBe("Nepoznato");
});

test("množina na srpskom i engleskom", async () => {
  expect(i18n.t("home.gamesCount", { count: 1 })).toBe("1 termin");
  expect(i18n.t("common.hours", { count: 3 })).toBe("3 sata");

  await act(() => changeLanguage("en"));

  expect(i18n.t("home.gamesCount", { count: 2 })).toBe("2 games");
});
