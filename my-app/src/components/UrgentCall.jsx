import { useState } from "react";
import { Siren } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { matchStart } from "../utils/matchDate";
import { useTranslation } from "react-i18next";

// Isto kao na serveru (services/urgentCallService.js)
export const URGENT_HOURS = 12;

// Da li kreator sme da pošalje hitni poziv: javni termin koji počinje
// u narednih URGENT_HOURS sati i ima slobodnih mesta
export const canCallUrgently = (match, freeSpots, now = new Date()) => {
  const hoursLeft = (matchStart(match.match_date, match.match_time) - now) / 3600000;

  return !match.is_private && freeSpots > 0 && hoursLeft > 0 && hoursLeft <= URGENT_HOURS;
};

// "Fali igrač": kreator jednim klikom javlja igračima iz okoline
function UrgentCall({ matchId, freeSpots, sentAt, onSent }) {
  const { t } = useTranslation();

  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const send = async () => {
    if (!window.confirm(t("urgentCall.confirm", { count: freeSpots }))) return;

    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/urgent-call`, {
        method: "POST",
        headers: authHeader(),
      });
      const data = await res.json();

      setStatus(data.message);

      if (data.success && data.notified > 0) onSent?.();
    } catch (error) {
      console.error(error);
      setStatus(t("urgentCall.couldNotSend"));
    } finally {
      setSending(false);
    }
  };

  if (sentAt) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
        <p className="font-semibold">{t("urgentCall.sentTitle")}</p>
        {status && <p className="mt-1">{status}</p>}
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <p className="font-bold text-red-900">{t("urgentCall.title", { count: freeSpots })}</p>
      <p className="text-sm text-red-800 mb-3">{t("urgentCall.hint")}</p>

      <button
        onClick={send}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold"
      >
        <Siren size={18} />
        {sending ? t("common.sending") : t("urgentCall.send")}
      </button>

      {status && <p className="text-sm text-red-800 mt-2">{status}</p>}
    </div>
  );
}

export default UrgentCall;
