import { pricePerPlayer, formatRSD, hasPrice } from "./price";

describe("pricePerPlayer", () => {
  test("deli ukupnu cenu na igrače", () => {
    expect(pricePerPlayer(3000, 10)).toBe(300);
  });

  test("zaokružuje naviše, da se skupi cela cena", () => {
    expect(pricePerPlayer(1000, 3)).toBe(334);
  });

  test("bez igrača deli kao da je jedan", () => {
    expect(pricePerPlayer(3000, 0)).toBe(3000);
  });
});

test("formatRSD dodaje tačku za hiljade i 'din'", () => {
  expect(formatRSD(12000)).toBe("12.000 din");
});

test.each([
  [{ field_price: 0 }, true],
  [{ field_price: 3000 }, true],
  [{ field_price: null }, false],
  [{}, false],
])("hasPrice(%j) = %s", (match, expected) => {
  expect(hasPrice(match)).toBe(expected);
});
