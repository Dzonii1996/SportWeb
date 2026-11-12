import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { useTranslation } from "react-i18next";

// Najbolji igrač termina: posle utakmice učesnici glasaju (jedan glas, ne za sebe).
// "people" su svi učesnici (igrači i kreator), za imena u rezultatu.
function MatchMvp({ matchId, people, userId }) {
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${matchId}/mvp`, { headers: authHeader() })
      .then((res) => res.json())
      .then((result) => result.success && setData(result))
      .catch(console.error);
  }, [matchId]);

  if (!data) return null;

  const nameOf = (id) => people.find((p) => p.id === id)?.name || "?";
  const votesOf = (id) => data.votes.find((v) => v.player_id === id)?.votes || 0;
  const candidates = people.filter((p) => p.id !== userId);

  if (!data.canVote && data.mvp.length === 0) return null;

  const vote = async (playerId) => {
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/mvp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ player_id: playerId }),
      });
      const result = await res.json();

      if (result.success) setData(result);
      else alert(result.message);
    } catch (error) {
      console.error(error);
      alert(t("matchMvp.couldNotSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-2xl font-bold">{t("matchMvp.title")}</h2>

      {data.mvp.length > 0 ? (
        <p className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 font-semibold text-amber-900">
          {t("matchMvp.winner", {
            names: data.mvp.map(nameOf).join(", "),
            count: votesOf(data.mvp[0]),
          })}
        </p>
      ) : (
        <p className="text-gray-500 text-sm mt-1">{t("matchMvp.hint", { count: data.minVotes })}</p>
      )}

      {data.canVote && candidates.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600">
            {data.myVote ? t("matchMvp.changeVote") : t("matchMvp.pickOne")}
          </p>

          {candidates.map((p) => {
            const mine = data.myVote === p.id;

            return (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                onClick={() => vote(mine ? null : p.id)}
                aria-pressed={mine}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition ${
                  mine ? "bg-amber-500 border-amber-500 text-white" : "hover:bg-gray-50"
                }`}
              >
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-sm shrink-0">
                  {mine ? t("matchMvp.yourVote") : t("matchMvp.votes", { count: votesOf(p.id) })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MatchMvp;
