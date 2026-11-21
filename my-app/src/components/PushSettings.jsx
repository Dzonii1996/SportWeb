import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { disablePush, enablePush, pushState } from "../utils/push";

// Uključivanje push obaveštenja na ovom uređaju (stranica Profil)
function PushSettings() {
  const { t } = useTranslation();

  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  const change = (action) => async () => {
    setBusy(true);
    setError(null);

    try {
      setState(await action());
    } catch (e) {
      setError(e.serverMessage || t("push.couldNotEnable"));
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return null;

  return (
    <div className="space-y-3">
      <label className="block font-semibold">{t("push.title")}</label>

      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-green-700">{t("push.on")}</p>
          <button
            type="button"
            onClick={change(() => disablePush())}
            disabled={busy}
            className="border border-gray-300 hover:bg-gray-100 disabled:opacity-60 px-4 py-2 rounded-xl font-semibold"
          >
            {t("push.disable")}
          </button>
        </div>
      )}

      {state === "off" && (
        <>
          <p className="text-sm text-gray-500">{t("push.description")}</p>
          <button
            type="button"
            onClick={change(enablePush)}
            disabled={busy}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-xl font-semibold"
          >
            {t("push.enable")}
          </button>
        </>
      )}

      {state === "install" && <p className="text-sm text-gray-500">{t("push.installFirst")}</p>}
      {state === "denied" && <p className="text-sm text-gray-500">{t("push.blocked")}</p>}
      {state === "unsupported" && <p className="text-sm text-gray-500">{t("push.unsupported")}</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default PushSettings;
