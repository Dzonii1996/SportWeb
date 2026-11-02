// Cena terena u formama za kreiranje i izmenu (nije obavezna)
function FieldPriceInput({ value, onChange, name }) {
  return (
    <div>
      <div className="flex items-center border rounded-xl pr-4 focus-within:ring-2 focus-within:ring-green-600">
        <input
          type="number"
          name={name}
          min="0"
          max="1000000"
          step="1"
          value={value}
          onChange={onChange}
          placeholder="Cena terena (nije obavezno)"
          className="w-full p-3 rounded-xl outline-none"
        />
        <span className="text-gray-500">din</span>
      </div>

      <p className="text-sm text-gray-500 mt-1">
        Ukupna cena; aplikacija sama računa koliko je po igraču.
      </p>
    </div>
  );
}

export default FieldPriceInput;
