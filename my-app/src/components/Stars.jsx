import { useState } from "react";
import { Star } from "lucide-react";

// Prikaz ocene zvezdicama; value može biti decimalan (4.5 = četiri i po)
export function Stars({ value = 0, size = 16 }) {
  return (
    <span className="inline-flex items-center" aria-label={`Ocena ${value} od 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));

        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-gray-300" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="text-amber-400 fill-amber-400" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

const LABELS = ["", "Loše", "Slabo", "Solidno", "Dobro", "Odlično"];

// Izbor ocene od 1 do 5 klikom na zvezdicu
export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-2">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} od 5`}
            className="p-0.5"
          >
            <Star
              size={30}
              className={n <= shown ? "text-amber-400 fill-amber-400" : "text-gray-300"}
            />
          </button>
        ))}
      </div>

      <span className="text-sm text-gray-600 w-16">{LABELS[shown]}</span>
    </div>
  );
}

// "★ 4.5 (12)" za kartice i zaglavlja; bez ocena ne prikazuje ništa
export function RatingBadge({ avg, count, className = "" }) {
  if (!count) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Star size={14} className="text-amber-400 fill-amber-400" />
      <span className="font-semibold">{avg.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 1 })}</span>
      <span className="opacity-75">({count})</span>
    </span>
  );
}
