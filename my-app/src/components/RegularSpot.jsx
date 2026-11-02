import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";

// Stalno mesto u ponavljajućem terminu: igrač se sam prijavljuje svake nedelje
function RegularSpot({ matchId }) {
  const [regular, setRegular] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/matches/${matchId}/regular`, {
      headers: authHeader(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.series) {
          setRegular(data.regular);
        }
      })
      .catch(console.error);
  }, [matchId]);

  // Termin nije deo serije (ili se još učitava)
  if (regular === null) return null;

  const toggle = async () => {
    setBusy(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/regular`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ regular: !regular }),
      });

      const data = await res.json();

      if (data.success) {
        setRegular(data.regular);
      } else {
        alert(data.message);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl cursor-pointer">
      <input
        type="checkbox"
        checked={regular}
        onChange={toggle}
        disabled={busy}
        className="w-5 h-5 mt-0.5"
      />

      <span>
        <span className="font-semibold text-green-800">Stalno mesto</span>
        <span className="block text-sm text-green-700">
          Automatski te prijavljujemo na ovaj termin svake nedelje.
          Ako ne možeš neke nedelje, samo napusti taj termin.
        </span>
      </span>
    </label>
  );
}

export default RegularSpot;
