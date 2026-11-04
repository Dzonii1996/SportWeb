import { useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { formatRSD, pricePerPlayer } from "../utils/price";
import { useTranslation } from "react-i18next";

// Troškovi terena: cena po igraču, a kreator čekira ko je platio
function MatchCosts({ match, players, isCreator, userId, onChange }) {
  const { t } = useTranslation();

  const [busyId, setBusyId] = useState(null);

  const total = match.field_price;
  const perPlayer = pricePerPlayer(total, players.length);
  const paidCount = players.filter((p) => p.paid).length;
  const me = players.find((p) => p.id === userId);

  const togglePaid = async (player) => {
    setBusyId(player.id);

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${match.id}/players/${player.id}/paid`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ paid: !player.paid }),
        }
      );

      const data = await res.json();

      if (data.success) {
        await onChange();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-amber-900">{t("matchCosts.venue")}</h3>

        <p className="text-sm text-amber-800">
          {t("matchCosts.total", { amount: formatRSD(total) })}
        </p>
      </div>

      <p className="text-2xl font-extrabold text-amber-900">
        {formatRSD(perPlayer)}{" "}
        <span className="text-base font-medium">{t("common.perPlayer")}</span>
      </p>

      <p className="text-xs text-amber-700">
        {players.length === 0
          ? t("matchCosts.theAmountWillBeSplit")
          : t("matchCosts.splitAmongPlayersChangesWhen", { length: players.length })}
      </p>

      {/* Igrač vidi svoj status */}
      {me && !isCreator && (
        <p className={`font-semibold ${me.paid ? "text-green-700" : "text-amber-900"}`}>
          {me.paid ? t("matchCosts.youPaidYourShare") : t("matchCosts.yourShareNotYetMarked", { amount: formatRSD(perPlayer) })}
        </p>
      )}

      {/* Kreator vodi evidenciju */}
      {isCreator && players.length > 0 && (
        <div className="border-t border-amber-200 pt-3">
          <div className="flex justify-between text-sm font-semibold text-amber-900 mb-2">
            <span>{t("matchCosts.whoHasPaid")}</span>
            <span>
              {formatRSD(Math.min(total, paidCount * perPlayer))} / {formatRSD(total)}
            </span>
          </div>

          <ul className="space-y-1">
            {players.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.paid}
                    disabled={busyId === p.id}
                    onChange={() => togglePaid(p)}
                    className="w-5 h-5"
                  />
                  <span className={p.paid ? "line-through text-gray-500" : ""}>
                    {p.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MatchCosts;
