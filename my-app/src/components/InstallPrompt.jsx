import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Share, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isIos, isStandalone } from "../utils/push";

const DISMISSED_KEY = "installDismissed";

const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password"];

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

// Predlog da se sajt instalira kao aplikacija na telefonu. Android (Chrome) nudi
// instalaciju sam (beforeinstallprompt); iPhone to ne radi, pa pokazujemo uputstvo.
function InstallPrompt() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ios = isIos();

  if (installed || dismissed || HIDDEN_ON.includes(pathname) || (!installEvent && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Bez localStorage baner se samo sklanja do osvežavanja
    }

    setDismissed(true);
  };

  const install = async () => {
    installEvent.prompt();

    const { outcome } = await installEvent.userChoice;

    setInstallEvent(null);

    if (outcome === "accepted") setInstalled(true);
  };

  return (
    <div
      role="dialog"
      aria-label={t("install.title")}
      className="fixed inset-x-3 z-50 md:left-auto md:right-6 md:w-96 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 flex gap-3 items-start"
    >
      <img src="/logo192.png" alt="" className="w-12 h-12 shrink-0" />

      <div className="flex-1 min-w-0 space-y-2">
        <p className="font-bold">{t("install.title")}</p>

        {installEvent ? (
          <>
            <p className="text-sm text-gray-600">{t("install.text")}</p>

            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold text-sm"
            >
              <Download size={16} aria-hidden="true" />
              {t("install.install")}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            {t("install.iosBefore")}{" "}
            <Share size={16} className="inline -mt-1 text-blue-600" aria-label={t("install.share")} />{" "}
            {t("install.iosAfter")}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={t("install.close")}
        className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default InstallPrompt;
