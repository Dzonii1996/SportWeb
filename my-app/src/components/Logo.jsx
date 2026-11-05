const SHIELD = "M32 2 58 9v25c0 14-11 23-26 28C17 57 6 48 6 34V9z";
const SPORT_LETTERS =
  "M20 12H15V15H19V18H14M22.500 19V12H26.500V15.500H22.500M30 12H34V18H30ZM37.500 19V12H41.500V15.500H37.500M39.500 15.500 41.500 19M44 12H50M47 12V19";
const COURT_LINE = { fill: "none", stroke: "#fff", strokeOpacity: 0.6, strokeWidth: 1 };

// Znak aplikacije: kroz grb prolaze tereni za fudbal, košarku, tenis i odbojku,
// sa svojim bojama i linijama (isti crtež je u public/logo.svg)
export default function Logo({ className = "w-11 h-11" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <clipPath id="logo-shield">
          <path d={SHIELD} />
        </clipPath>
      </defs>

      <g clipPath="url(#logo-shield)">
        <g transform="rotate(-18 32 32)">
          {/* Podloge terena */}
          <rect x="-24" y="-24" width="44" height="112" fill="#16a34a" />
          <rect x="20" y="-24" width="12" height="112" fill="#d97706" />
          <rect x="32" y="-24" width="12" height="112" fill="#2563eb" />
          <rect x="44" y="-24" width="44" height="112" fill="#ea580c" />

          {/* Fudbal: centralni krug */}
          <circle cx="12" cy="36" r="8" {...COURT_LINE} />
          {/* Košarka: linija za tri poena */}
          <path d="M20 22A11 11 0 0 1 20 44" {...COURT_LINE} />
          {/* Tenis: servis polja */}
          <path d="M32 22H44M32 44H44M38 22V44" {...COURT_LINE} />
          {/* Odbojka: mreža i linija napada */}
          <path d="M53-24V88" {...COURT_LINE} />
          <path d="M48.5-24V88" {...COURT_LINE} strokeDasharray="3 3" />

          {/* Granice terena prolaze kroz ceo grb */}
          <path d="M20-24V88M32-24V88M44-24V88" {...COURT_LINE} />
        </g>
      </g>

      <path d={SHIELD} fill="none" stroke="#0f172a" strokeOpacity="0.3" />

      <path d={SPORT_LETTERS} fill="none" stroke="#0f172a" strokeOpacity="0.4" strokeWidth="3.2" />
      <path d={SPORT_LETTERS} fill="none" stroke="#fff" strokeWidth="2.2" />

      <g
        fill="#fff"
        stroke="#0f172a"
        strokeOpacity="0.4"
        strokeWidth="2.2"
        paintOrder="stroke"
        transform="translate(32 33) scale(.72) translate(-33 -32)"
      >
        <polygon points="10,18 16.5,18 16.5,28 24,18 31.5,18 22.5,30 32,46 24.5,46 18.5,35.5 16.5,38 16.5,46 10,46" />
        <polygon points="34,46 34,18 40.5,18 45,30 49.5,18 56,18 56,46 50,46 50,30 46.8,39 43.2,39 40,30 40,46" />
      </g>
    </svg>
  );
}
