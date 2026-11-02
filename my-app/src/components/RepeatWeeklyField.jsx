// Polje za ponavljajući termin u formama za kreiranje i izmenu
function RepeatWeeklyField({ checked, onChange, inSeries = false }) {
  return (
    <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5"
      />

      <span>
        <span className="font-semibold">🔁 Ponavljaj svake nedelje</span>

        <span className="block text-sm text-gray-500">
          {inSeries && checked
            ? "Izmene važe i za sledeće termine. Isključi da zaustaviš seriju."
            : "Kad ovaj termin počne, automatski se otvara isti termin nedelju dana kasnije. Igrači sa stalnim mestom se prijavljuju sami."}
        </span>
      </span>
    </label>
  );
}

export default RepeatWeeklyField;
