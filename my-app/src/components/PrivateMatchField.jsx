import { useTranslation } from "react-i18next";

// Privatni termin u formama za kreiranje i izmenu
function PrivateMatchField({ checked, onChange }) {
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
        <span className="font-semibold">{t("privateMatchField.privateGame")}</span>

        <span className="block text-sm text-gray-500">
          {t("privateMatchField.doesntAppearInTheGame")}
        </span>
      </span>
    </label>
  );
}

export default PrivateMatchField;
