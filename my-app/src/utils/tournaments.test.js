import { roundLabel, groupByRound, isBye } from "./tournaments";

test("roundLabel imenuje poslednja kola kupa", () => {
  expect(roundLabel("knockout", 4, 4)).toBe("Finale");
  expect(roundLabel("knockout", 3, 4)).toBe("Polufinale");
  expect(roundLabel("knockout", 2, 4)).toBe("Četvrtfinale");
  expect(roundLabel("knockout", 1, 4)).toBe("1. kolo");
  expect(roundLabel("league", 3, 3)).toBe("3. kolo");
});

test("groupByRound grupiše utakmice po kolu", () => {
  const groups = groupByRound([{ id: 1, round: 1 }, { id: 2, round: 1 }, { id: 3, round: 2 }]);

  expect(groups.map((g) => [g.round, g.games.length])).toEqual([[1, 2], [2, 1]]);
});

test("isBye prepoznaje slobodan prolaz, ali ne utakmicu koja čeka ekipe", () => {
  expect(isBye({ team_a_id: 1, team_b_id: null, winner_team_id: 1 })).toBe(true);
  expect(isBye({ team_a_id: 1, team_b_id: null, winner_team_id: null })).toBe(false);
  expect(isBye({ team_a_id: 1, team_b_id: 2, winner_team_id: 1 })).toBe(false);
});
