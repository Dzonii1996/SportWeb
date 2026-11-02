import { useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";

// "Dolaziš li?" za prijavljenog igrača, u poslednja 24 sata pred termin.
// "Ne mogu" ga odjavljuje, pa mesto dobija prvi sa liste čekanja.
function AttendanceBox({ matchId, confirmed, onChange }) {
  const [busy, setBusy] = useState(false);

  const send = async (path, method) => {
    setBusy(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/${path}`, {
        method,
        headers: authHeader(),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message);
      }

      await onChange();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const cantCome = () => {
    if (window.confirm("Odjaviti se sa termina? Mesto će dobiti neko sa liste čekanja.")) {
      send("leave", "DELETE");
    }
  };

  if (confirmed) {
    return (
      <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <span className="font-semibold text-green-800">✓ Potvrdio si dolazak</span>

        <button
          onClick={cantCome}
          disabled={busy}
          className="text-sm text-gray-500 hover:text-red-600 hover:underline"
        >
          Ipak ne mogu
        </button>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
      <p className="font-bold text-amber-900">Dolaziš li?</p>
      <p className="text-sm text-amber-800 mb-3">
        Termin je uskoro. Potvrdi, da organizator zna na koga može da računa.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => send("confirm", "POST")}
          disabled={busy}
          className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
        >
          ✓ Dolazim
        </button>

        <button
          onClick={cantCome}
          disabled={busy}
          className="py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold"
        >
          ✗ Ne mogu
        </button>
      </div>
    </div>
  );
}

export default AttendanceBox;
