import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { photoUrl } from "./PhotoGallery";

// Logo na beloj podlozi, da se vidi i na tamnoj i na obojenoj pozadini.
// Bela je stalna (#ffffff, ne bg-white): logo izgleda isto i u tamnom režimu.
export function LogoBadge({ path, alt = "", className = "w-14 h-14" }) {
  return (
    <span className={`${className} shrink-0 rounded-xl bg-[#ffffff] p-1 flex items-center justify-center shadow-sm`}>
      <img src={photoUrl(path)} alt={alt} className="max-w-full max-h-full object-contain" />
    </span>
  );
}

// Organizator dodaje, menja ili uklanja logo turnira (npr. škole domaćina)
function TournamentLogo({ tournament, onChange }) {
  const { t } = useTranslation();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const url = `${API_URL}/api/tournaments/${tournament.id}/logo`;

  const send = async (options) => {
    setBusy(true);

    try {
      const res = await fetch(url, { ...options, headers: authHeader() });
      const data = await res.json();

      if (!data.success) alert(data.message);
      else onChange();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    const body = new FormData();
    body.append("logo", file);
    send({ method: "POST", body });
  };

  const remove = () => {
    if (window.confirm(t("tournamentLogo.removeConfirm"))) send({ method: "DELETE" });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {tournament.logo_path ? (
        <LogoBadge path={tournament.logo_path} alt={t("tournamentLogo.logo")} className="w-14 h-14 border" />
      ) : (
        <span className="w-14 h-14 shrink-0 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
          <ImagePlus size={22} />
        </span>
      )}

      <div className="flex-1 min-w-[10rem]">
        <p className="font-medium">{t("tournamentLogo.logo")}</p>
        <p className="text-sm text-gray-500">{t("tournamentLogo.hint")}</p>
      </div>

      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="hidden" />

      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="px-4 py-2 rounded-xl border border-gray-200 font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {tournament.logo_path ? t("tournamentLogo.change") : t("tournamentLogo.add")}
        </button>

        {tournament.logo_path && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            title={t("common.remove")}
            aria-label={t("common.remove")}
            className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={18} />
          </button>
        )}
      </span>
    </div>
  );
}

export default TournamentLogo;
