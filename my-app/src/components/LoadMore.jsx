import { useTranslation } from "react-i18next";

// Dugme "Učitaj još" ispod liste koja se puni po stranama
function LoadMore({ onClick, loading = false, className = "" }) {
  const { t } = useTranslation();

  return (
    <div className={`flex justify-center ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="px-6 py-2.5 rounded-full border border-gray-300 bg-white font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {loading ? t("common.loading") : t("common.loadMore")}
      </button>
    </div>
  );
}

export default LoadMore;
