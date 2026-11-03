import { busyAt, maxDurationFrom, hourLabel } from "./reservations";

const busy = [
  { start_hour: 10, end_hour: 11, status: "confirmed" },
  { start_hour: 18, end_hour: 20, status: "pending" },
];

test("busyAt pronalazi rezervaciju koja pokriva sat", () => {
  expect(busyAt(10, busy)).toBe(busy[0]);
  expect(busyAt(19, busy)).toBe(busy[1]);
  expect(busyAt(11, busy)).toBeNull();
  expect(busyAt(20, busy)).toBeNull();
});

test("maxDurationFrom staje kod zauzetog sata, zatvaranja i najviše 4 sata", () => {
  expect(maxDurationFrom(16, busy, 22)).toBe(2);
  expect(maxDurationFrom(11, busy, 22)).toBe(4);
  expect(maxDurationFrom(20, busy, 22)).toBe(2);
  expect(maxDurationFrom(18, busy, 22)).toBe(0);
  expect(maxDurationFrom(21, [], 24)).toBe(3);
});

test("hourLabel dodaje vodeću nulu", () => {
  expect(hourLabel(8)).toBe("08:00");
  expect(hourLabel(24)).toBe("24:00");
});
