import { canCallUrgently } from "./UrgentCall";

const now = new Date(2026, 10, 12, 15, 0);
const at = (hour) => ({ match_date: new Date(2026, 10, 12), match_time: `${hour}:00:00`, is_private: false });

test("hitni poziv samo za javni termin u narednih 12 sati sa slobodnim mestima", () => {
  expect(canCallUrgently(at(18), 2, now)).toBe(true);
  expect(canCallUrgently(at(14), 2, now)).toBe(false);
  expect(canCallUrgently(at(18), 0, now)).toBe(false);
  expect(canCallUrgently({ ...at(18), is_private: true }, 2, now)).toBe(false);
  expect(canCallUrgently({ ...at(10), match_date: new Date(2026, 10, 13) }, 2, now)).toBe(false);
});
