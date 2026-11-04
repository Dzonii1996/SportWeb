import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { formatRSD } from "../utils/price";
import { indoorLabel } from "../utils/venues";
import { useTranslation } from "react-i18next";
import { surfaceLabel } from "../i18n";

// Izbor terena iz kataloga u formi termina. value: ID terena ili "" (ručni unos).
// onChange dobija ceo teren ili null. Prikazuju se samo tereni za izabrani sport;
// currentName je naziv terena koji termin već ima, a više nije na listi.
function VenuePicker({ venues, sport, value, onChange, currentName = null }) {
  const { t } = useTranslation();

  const list = (venues || []).filter((v) => v.sports.includes(sport));
  const selected = list.find((v) => String(v.id) === String(value));
  const missing = value && !selected;

  const handleChange = (e) => {
    const venue = list.find((v) => String(v.id) === e.target.value);

    // Teren koji više nije na listi ostaje izabran bez izmena
    if (!venue && e.target.value !== "") return;

    onChange(venue || null);
  };

  return (
    <div className="space-y-2">
      <select value={value} onChange={handleChange} className="w-full border p-3 rounded-xl">
        <option value="">{t("venuePicker.enterLocationManually")}</option>

        {missing && <option value={value}>🏟️ {currentName || t("venuePicker.currentVenue")}</option>}

        {list.map((v) => (
          <option key={v.id} value={v.id}>
            🏟️ {v.name}
          </option>
        ))}
      </select>

      {venues && list.length === 0 && !value && (
        <p className="text-sm text-gray-500">
          {t("venuePicker.noVenuesForThisSport")}{" "}
          <Link to="/tereni/predlozi" className="text-green-700 hover:underline">
            {t("common.suggestAVenue")}
          </Link>
        </p>
      )}

      {selected && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-gray-700">
          <MapPin className="text-green-600 shrink-0 mt-0.5" size={18} />
          <div>
            <p>{selected.address}</p>
            <p className="text-gray-500">
              {indoorLabel(selected.indoor)}
              {selected.surface && ` · ${surfaceLabel(selected.surface)}`}
              {selected.price_per_hour !== null && t("venuePicker.aboutH", { amount: formatRSD(selected.price_per_hour) })}
            </p>
            <Link
              to={`/tereni/${selected.id}`}
              target="_blank"
              className="text-green-700 hover:underline font-medium"
            >
              {t("venuePicker.aboutTheVenue")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default VenuePicker;
