// Privatni termin u formama za kreiranje i izmenu
function PrivateMatchField({ checked, onChange }) {
  return (
    <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5"
      />

      <span>
        <span className="font-semibold">🔒 Privatni termin</span>

        <span className="block text-sm text-gray-500">
          Ne pojavljuje se na listi termina. Vide ga i prijavljuju se samo
          oni kojima pošalješ link ili pozivnicu.
        </span>
      </span>
    </label>
  );
}

export default PrivateMatchField;
