import { useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { hourLabel } from "../utils/reservations";

const HOURS = Array.from({ length: 25 }, (_, h) => h);

// Vlasnik (ili admin) uključuje rezervacije i bira u kojim satima su moguće
function ReservationSettings({ venue, onSaved }) {
  const [accepts, setAccepts] = useState(venue.accepts_reservations);
  const [open, setOpen] = useState(venue.reservation_open_hour);
  const [close, setClose] = useState(venue.reservation_close_hour);
  const [saving, setSaving] = useState(false);

  const hasOwner = Boolean(venue.owner_id);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/venues/${venue.id}/reservation-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          accepts_reservations: accepts,
          reservation_open_hour: open,
          reservation_close_hour: close,
        }),
      });
      const data = await res.json();

      alert(data.message);

      if (data.success) onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="text-xl font-bold">Podešavanja rezervacija</h2>

      {!hasOwner && (
        <p className="text-sm text-gray-600">
          Rezervacije mogu da se uključe kad teren dobije vlasnika, jer ih on potvrđuje.
        </p>
      )}

      <label className="flex items-center gap-2 font-medium cursor-pointer">
        <input
          type="checkbox"
          checked={accepts}
          disabled={!hasOwner}
          onChange={() => setAccepts(!accepts)}
          className="w-4 h-4"
        />
        Teren prima rezervacije preko SportWeb-a
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <span>Moguće od</span>
        <select
          value={open}
          onChange={(e) => setOpen(Number(e.target.value))}
          className="border p-2 rounded-xl"
          aria-label="Od"
        >
          {HOURS.slice(0, 24).map((h) => (
            <option key={h} value={h}>{hourLabel(h)}</option>
          ))}
        </select>
        <span>do</span>
        <select
          value={close}
          onChange={(e) => setClose(Number(e.target.value))}
          className="border p-2 rounded-xl"
          aria-label="Do"
        >
          {HOURS.slice(1).map((h) => (
            <option key={h} value={h}>{hourLabel(h)}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-semibold"
      >
        {saving ? "Čuvam..." : "Sačuvaj"}
      </button>
    </form>
  );
}

export default ReservationSettings;
