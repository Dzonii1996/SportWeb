import { useTranslation } from "react-i18next";

export const BYE = "bye";

// Broj mesta u kosturu: 6 ekipa -> 8 mesta (dva slobodna prolaza)
export const bracketSize = (teams) => 2 ** Math.ceil(Math.log2(Math.max(teams, 2)));

export const emptyPairs = (teams) => Array.from({ length: bracketSize(teams) / 2 }, () => ["", ""]);

// Za server: [[id, id], [id, null], ...]
export const pairsForServer = (pairs) =>
  pairs.map((pair) => pair.map((v) => (v === "" || v === BYE ? null : Number(v))));

// Koliko je ekipa raspoređeno i da li je žreb kompletan
export const drawStatus = (pairs, teams) => {
  const placed = pairs.flat().filter((v) => v !== "" && v !== BYE).length;
  const emptyPair = pairs.some((pair) => pair.every((v) => v === "" || v === BYE));

  return { placed, complete: placed === teams.length && !emptyPair };
};

// Parovi prvog kola iz žreba održanog van aplikacije. Pobednici utakmica 1 i 2
// se sreću u sledećem kolu, 3 i 4 takođe; prva polovina je leva strana kostura.
function DrawPairs({ teams, pairs, onChange }) {
  const { t } = useTranslation();

  const byes = bracketSize(teams.length) - teams.length;
  const used = new Set(pairs.flat().filter((v) => v !== "" && v !== BYE));
  const byesUsed = pairs.flat().filter((v) => v === BYE).length;
  const half = pairs.length / 2;

  const set = (row, side, value) =>
    onChange(pairs.map((pair, i) => (i === row ? pair.map((v, s) => (s === side ? value : v)) : pair)));

  const select = (row, side) => {
    const value = pairs[row][side];

    return (
      <select
        value={value}
        onChange={(e) => set(row, side, e.target.value)}
        className={`flex-1 min-w-0 border p-2 rounded-lg bg-white ${value === "" ? "text-gray-400" : ""}`}
        aria-label={t("tournamentDetails.drawSlot", { n: row + 1, side: side + 1 })}
      >
        <option value="">{t("tournamentDetails.chooseTeam")}</option>
        {teams
          .filter((team) => !used.has(String(team.id)) || String(team.id) === value)
          .map((team) => (
            <option key={team.id} value={String(team.id)} className="text-gray-900">
              {team.name}
            </option>
          ))}
        {(value === BYE || byesUsed < byes) && (
          <option value={BYE} className="text-gray-900">— {t("tournamentDetails.bye")} —</option>
        )}
      </select>
    );
  };

  return (
    <div className="space-y-2">
      {pairs.map((_, row) => (
        <div key={row}>
          {pairs.length > 1 && row === half && <div className="border-t border-dashed my-3" />}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-sm font-semibold text-gray-500 text-right">{row + 1}.</span>
            {select(row, 0)}
            <span className="text-gray-400">–</span>
            {select(row, 1)}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-500">{t("tournamentDetails.drawHint")}</p>
    </div>
  );
}

export default DrawPairs;
