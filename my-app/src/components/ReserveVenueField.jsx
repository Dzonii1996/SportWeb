import { MAX_HOURS, hourLabel } from "../utils/reservations";

// U formi termina: rezerviši i teren (zahtev ide vlasniku zajedno sa terminom).
// Prikazuje se samo za teren koji prima rezervacije.
function ReserveVenueField({ checked, onChange, hours, onHoursChange, time }) {
  const fullHour = !time || /^\d{2}:00$/.test(time);
  const start = time ? Number(time.slice(0, 2)) : null;

  return (
    <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-2">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 mt-0.5"
        />
        <span>
          <span className="font-semibold">📅 Rezerviši i teren</span>
          <span className="block text-sm text-gray-600">
            Vlasnik dobija zahtev i potvrđuje ga. Ako je vreme zauzeto, termin se ne pravi.
          </span>
        </span>
      </label>

      {checked && (
        <div className="flex flex-wrap items-center gap-2 pl-8">
          <select
            value={hours}
            onChange={(e) => onHoursChange(Number(e.target.value))}
            className="border p-2 rounded-xl bg-white"
            aria-label="Trajanje rezervacije"
          >
            {Array.from({ length: MAX_HOURS }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h} {h === 1 ? "sat" : "sata"}
              </option>
            ))}
          </select>

          {start !== null && fullHour && (
            <span className="text-sm text-gray-700">
              od {hourLabel(start)} do {hourLabel(start + hours)}
            </span>
          )}

          {!fullHour && (
            <span className="text-sm text-red-600">
              Teren se rezerviše na pun sat; izaberi vreme kao 19:00.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ReserveVenueField;
