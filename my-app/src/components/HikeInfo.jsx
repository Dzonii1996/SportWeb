import { useTranslation } from "react-i18next";
import { difficultyLabel } from "../utils/hike";

const DIFFICULTY_COLORS = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-700",
};

// Podaci o stazi na stranici termina, sa napomenom o odgovornosti
function HikeInfo({ hike }) {
  const { t } = useTranslation();

  const stats = [
    [hike.distance_km, t("hike.km", { value: hike.distance_km })],
    [hike.ascent_m, t("hike.ascent", { value: hike.ascent_m })],
    [hike.duration_hours, t("hike.hours", { value: hike.duration_hours })],
  ].filter(([value]) => value !== null && value !== undefined);

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-gray-900">⛰️ {hike.route}</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[hike.difficulty]}`}>
          {difficultyLabel(hike.difficulty)}
        </span>
      </div>

      {stats.length > 0 && (
        <p className="text-gray-700">{stats.map(([, label]) => label).join(" · ")}</p>
      )}

      {hike.gear && (
        <p className="text-gray-700 whitespace-pre-line">🎒 {hike.gear}</p>
      )}

      <p className="text-xs text-gray-500">{t("hike.ownResponsibility")}</p>
    </div>
  );
}

export default HikeInfo;
