import { useTranslation } from "react-i18next";

// Cena terena u formama za kreiranje i izmenu (nije obavezna)
function FieldPriceInput({ value, onChange, name }) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center border rounded-xl pr-4 focus-within:ring-2 focus-within:ring-green-600">
        <input
          type="number"
          name={name}
          min="0"
          max="1000000"
          step="1"
          value={value}
          onChange={onChange}
          placeholder={t("fieldPriceInput.venuePriceOptional")}
          className="w-full p-3 rounded-xl outline-none"
        />
        <span className="text-gray-500">{t("common.rsd")}</span>
      </div>

      <p className="text-sm text-gray-500 mt-1">
        {t("fieldPriceInput.totalPriceTheAppWorks")}
      </p>
    </div>
  );
}

export default FieldPriceInput;
