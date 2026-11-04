import { useTranslation } from "react-i18next";

// Polje za ponavljajući termin u formama za kreiranje i izmenu
function RepeatWeeklyField({ checked, onChange, inSeries = false }) {
  const { t } = useTranslation();

  return (
    <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5"
      />

      <span>
        <span className="font-semibold">{t("repeatWeeklyField.repeatEveryWeek")}</span>

        <span className="block text-sm text-gray-500">
          {inSeries && checked
            ? t("repeatWeeklyField.changesAlsoApplyToUpcoming")
            : t("repeatWeeklyField.whenThisGameStartsThe")}
        </span>
      </span>
    </label>
  );
}

export default RepeatWeeklyField;
