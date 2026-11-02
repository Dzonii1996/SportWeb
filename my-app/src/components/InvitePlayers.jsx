import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";

const avatarOf = (p) =>
  p.avatar ? (
    <img src={`${API_URL}${p.avatar}`} alt={p.name} className="w-9 h-9 rounded-full object-cover" />
  ) : (
    <span className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
      {p.name.charAt(0).toUpperCase()}
    </span>
  );

// Kreator poziva ljude sa kojima je već igrao; oni dobijaju notifikaciju
function InvitePlayers({ matchId }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const load = async () => {
    setCandidates(null);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/invite-candidates`, {
        headers: authHeader(),
      });
      const data = await res.json();

      setCandidates(data.candidates || []);
    } catch (error) {
      console.error(error);
      setCandidates([]);
    }
  };

  const openModal = () => {
    setOpen(true);
    setSelected([]);
    setStatus("");
    load();
  };

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const available = (candidates || []).filter((c) => !c.invited);

  const send = async () => {
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ user_ids: selected }),
      });
      const data = await res.json();

      setStatus(data.message);

      if (data.success) {
        setSelected([]);
        await load();
      }
    } catch (error) {
      console.error(error);
      setStatus("Greška pri slanju poziva.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition"
      >
        <Mail size={17} />
        Pozovi saigrače
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-xl font-bold">📩 Pozovi igrače</h2>
                <p className="text-sm text-gray-500">
                  Saigrači iz tvojih ranijih termina
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100"
                aria-label="Zatvori"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {candidates === null ? (
                <p className="p-4 text-center text-gray-500">Učitavanje...</p>
              ) : candidates.length === 0 ? (
                <p className="p-4 text-center text-gray-500">
                  Ovde se pojavljuju saigrači iz tvojih ranijih termina.
                  Za sada ih nema, pa podeli link termina.
                </p>
              ) : (
                <>
                  {available.length > 1 && (
                    <button
                      onClick={() =>
                        setSelected(
                          selected.length === available.length
                            ? []
                            : available.map((c) => c.id)
                        )
                      }
                      className="text-sm text-green-700 hover:underline px-3 mb-1"
                    >
                      {selected.length === available.length ? "Poništi izbor" : "Izaberi sve"}
                    </button>
                  )}

                  <ul>
                    {candidates.map((c) => (
                      <li key={c.id}>
                        <label
                          className={`flex items-center gap-3 p-3 rounded-xl ${
                            c.invited ? "opacity-60" : "hover:bg-gray-50 cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={c.invited}
                            checked={c.invited || selected.includes(c.id)}
                            onChange={() => toggle(c.id)}
                            className="w-5 h-5"
                          />

                          {avatarOf(c)}

                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold truncate">{c.name}</span>
                            <span className="block text-xs text-gray-500">
                              {c.together} {c.together === 1 ? "zajednički termin" : "zajedničkih termina"}
                            </span>
                          </span>

                          {c.invited && (
                            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              Poziv poslat
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="p-4 border-t space-y-2">
              {status && (
                <p className="text-sm text-center text-green-700">{status}</p>
              )}

              <button
                onClick={send}
                disabled={sending || selected.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold"
              >
                {sending
                  ? "Šaljem..."
                  : `Pošalji pozive${selected.length ? ` (${selected.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Traka za pozvanog igrača koji se još nije prijavio
export function InviteBanner({ matchId }) {
  const [invitedBy, setInvitedBy] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${matchId}/my-invite`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => setInvitedBy(data.invited ? data.invited_by : null))
      .catch(console.error);
  }, [matchId]);

  if (!invitedBy) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 font-medium">
      📩 Pozivnica za ovaj termin od: <strong>{invitedBy}</strong>
    </div>
  );
}

export default InvitePlayers;
