import { useTranslation } from "react-i18next";
import { DIFFICULTIES, difficultyLabel } from "../utils/hike";

const input = "w-full border p-3 rounded-xl";

// Podaci o stazi u formi termina za planinarenje
function HikeFields({ value, onChange }) {
  const { t } = useTranslation();

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
      <p className="font-semibold">{t("hike.aboutTheTrail")}</p>

      <input
        className={`${input} bg-white`}
        placeholder={t("hike.routePlaceholder")}
        value={value.route}
        onChange={set("route")}
        required
        minLength={2}
        maxLength={100}
      />

      <fieldset>
        <legend className="text-sm font-medium mb-1.5">{t("hike.difficulty")}</legend>

        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={value.difficulty === d}
              onClick={() => onChange({ ...value, difficulty: d })}
              className={`py-2 rounded-xl text-sm font-semibold transition ${
                value.difficulty === d ? "bg-green-600 text-white" : "bg-white border hover:bg-gray-50"
              }`}
            >
              {difficultyLabel(d)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm font-medium">
          {t("hike.distanceKm")}
          <input
            type="number"
            min="0.1"
            max="200"
            step="0.1"
            value={value.distance_km}
            onChange={set("distance_km")}
            className={`${input} bg-white mt-1`}
          />
        </label>

        <label className="text-sm font-medium">
          {t("hike.ascentM")}
          <input
            type="number"
            min="0"
            max="9000"
            step="1"
            value={value.ascent_m}
            onChange={set("ascent_m")}
            className={`${input} bg-white mt-1`}
          />
        </label>

        <label className="text-sm font-medium">
          {t("hike.durationH")}
          <input
            type="number"
            min="0.5"
            max="72"
            step="0.5"
            value={value.duration_hours}
            onChange={set("duration_hours")}
            className={`${input} bg-white mt-1`}
          />
        </label>
      </div>

      <textarea
        className={`${input} bg-white`}
        rows={2}
        maxLength={500}
        placeholder={t("hike.gearPlaceholder")}
        value={value.gear}
        onChange={set("gear")}
      />
    </div>
  );
}

export default HikeFields;
