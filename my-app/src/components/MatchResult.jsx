import { useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { matchStart } from "../utils/matchDate";

const RESULT_DAYS = 7;

// Ishod za tim: 'W' pobeda, 'D' nerešeno, 'L' poraz (isto kao na serveru)
const outcome = (team, a, b) =>
  a === b ? "D" : (team === "A" ? a > b : b > a) ? "W" : "L";

const MY_RESULT = {
  W: { text: "🏆 Tvoj tim je pobedio!", style: "bg-green-100 text-green-800" },
  D: { text: "🤝 Nerešeno", style: "bg-gray-100 text-gray-700" },
  L: { text: "Poraz, ali sledeći put je vaš 💪", style: "bg-red-50 text-red-700" },
};

// Rezultat odigranog termina: prikaz za sve, upis za kreatora (7 dana posle)
function MatchResult({ match, players, isCreator, userId, onChange }) {
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(hasScore ? match.score_a : "");
  const [scoreB, setScoreB] = useState(hasScore ? match.score_b : "");
  const [busy, setBusy] = useState(false);

  const deadline = new Date(matchStart(match.match_date, match.match_time));
  deadline.setDate(deadline.getDate() + RESULT_DAYS);
  const canEdit = isCreator && new Date() < deadline;

  const hasTeams = players.some((p) => p.team);
  const me = players.find((p) => p.id === userId);

  if (!hasScore && !canEdit) return null;

  const save = async (body) => {
    setBusy(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${match.id}/result`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setEditing(false);
        await onChange();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    save({ score_a: Number(scoreA), score_b: Number(scoreB) });
  };

  const scoreInput = (value, setValue, label) => (
    <input
      type="number"
      min="0"
      max="999"
      required
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label={label}
      className="w-20 text-center text-3xl font-extrabold border-2 rounded-xl p-2 focus:outline-none focus:border-green-600"
    />
  );

  const winnerA = hasScore && match.score_a > match.score_b;
  const winnerB = hasScore && match.score_b > match.score_a;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">🏆 Rezultat</h2>

        {canEdit && hasScore && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-green-700 hover:underline"
          >
            Izmeni
          </button>
        )}
      </div>

      {hasScore && !editing ? (
        <>
          <div className="flex items-center justify-center gap-4">
            <div className={`text-center ${winnerA ? "" : "opacity-60"}`}>
              <p className="text-sm font-semibold text-green-700">Tim A</p>
              <p className="text-5xl font-extrabold">{match.score_a}</p>
            </div>

            <span className="text-3xl font-bold text-gray-300">:</span>

            <div className={`text-center ${winnerB ? "" : "opacity-60"}`}>
              <p className="text-sm font-semibold text-blue-700">Tim B</p>
              <p className="text-5xl font-extrabold">{match.score_b}</p>
            </div>
          </div>

          {me?.team && (
            <p
              className={`mt-4 text-center font-semibold rounded-xl py-2 ${
                MY_RESULT[outcome(me.team, match.score_a, match.score_b)].style
              }`}
            >
              {MY_RESULT[outcome(me.team, match.score_a, match.score_b)].text}
            </p>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-sm font-semibold text-green-700 mb-1">Tim A</p>
              {scoreInput(scoreA, setScoreA, "Golovi tima A")}
            </div>

            <span className="text-3xl font-bold text-gray-300 mt-6">:</span>

            <div className="text-center">
              <p className="text-sm font-semibold text-blue-700 mb-1">Tim B</p>
              {scoreInput(scoreB, setScoreB, "Golovi tima B")}
            </div>
          </div>

          {!hasTeams && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              Timovi nisu podeljeni. Podeli ih u odeljku „Učesnici“, da bi
              rezultat ušao u statistiku igrača.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2.5 rounded-xl font-semibold"
            >
              Sačuvaj rezultat
            </button>

            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                Otkaži
              </button>
            )}
          </div>

          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ score_a: null, score_b: null })}
              className="w-full text-sm text-red-600 hover:underline"
            >
              Obriši rezultat
            </button>
          )}
        </form>
      )}
    </div>
  );
}

export default MatchResult;
