// Pozadine za hero na početnoj strani: fudbalski i košarkaški teren u SVG-u.
// "slice" popunjava ceo prostor, pa se teren seče na užim ekranima.

const LINE = { fill: "none", stroke: "rgba(255,255,255,0.75)", strokeWidth: 4 };

export function FootballPitch() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#15803d" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#grass)" />

      {/* Pruge košene trave */}
      {Array.from({ length: 12 }, (_, i) =>
        i % 2 === 0 ? (
          <rect key={i} x={i * 100} y="0" width="100" height="700" fill="rgba(255,255,255,0.06)" />
        ) : null
      )}

      {/* Linije terena */}
      <rect x="60" y="50" width="1080" height="600" {...LINE} />
      <line x1="600" y1="50" x2="600" y2="650" {...LINE} />
      <circle cx="600" cy="350" r="95" {...LINE} />
      <circle cx="600" cy="350" r="6" fill="rgba(255,255,255,0.75)" />

      {/* Kazneni i golmanov prostor, levo i desno */}
      <rect x="60" y="180" width="170" height="340" {...LINE} />
      <rect x="60" y="270" width="60" height="160" {...LINE} />
      <path d="M230 285 A 95 95 0 0 1 230 415" {...LINE} />
      <circle cx="175" cy="350" r="5" fill="rgba(255,255,255,0.75)" />

      <rect x="970" y="180" width="170" height="340" {...LINE} />
      <rect x="1080" y="270" width="60" height="160" {...LINE} />
      <path d="M970 285 A 95 95 0 0 0 970 415" {...LINE} />
      <circle cx="1025" cy="350" r="5" fill="rgba(255,255,255,0.75)" />

      {/* Golovi */}
      <rect x="40" y="315" width="20" height="70" {...LINE} />
      <rect x="1140" y="315" width="20" height="70" {...LINE} />

      {/* Ugaoni lukovi */}
      <path d="M60 70 A 20 20 0 0 0 80 50" {...LINE} />
      <path d="M1120 50 A 20 20 0 0 0 1140 70" {...LINE} />
      <path d="M80 650 A 20 20 0 0 0 60 630" {...LINE} />
      <path d="M1140 630 A 20 20 0 0 0 1120 650" {...LINE} />
    </svg>
  );
}

export function BasketballCourt() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="0.5" stopColor="#d97706" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#wood)" />

      {/* Daske parketa */}
      {Array.from({ length: 24 }, (_, i) => (
        <line
          key={i}
          x1="0"
          y1={i * 30}
          x2="1200"
          y2={i * 30}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="2"
        />
      ))}

      {/* Reketi (obojena zona ispod koša) */}
      <rect x="60" y="255" width="230" height="190" fill="rgba(30,64,175,0.55)" />
      <rect x="910" y="255" width="230" height="190" fill="rgba(30,64,175,0.55)" />

      {/* Linije terena */}
      <rect x="60" y="50" width="1080" height="600" {...LINE} />
      <line x1="600" y1="50" x2="600" y2="650" {...LINE} />
      <circle cx="600" cy="350" r="70" {...LINE} />
      <circle cx="600" cy="350" r="25" fill="rgba(30,64,175,0.55)" stroke="rgba(255,255,255,0.75)" strokeWidth="4" />

      {/* Leva strana: reket, krug slobodnih bacanja, trojka, koš */}
      <rect x="60" y="255" width="230" height="190" {...LINE} />
      <circle cx="290" cy="350" r="70" {...LINE} />
      <path d="M60 100 L 150 100 A 260 260 0 0 1 150 600 L 60 600" {...LINE} />
      <line x1="100" y1="315" x2="100" y2="385" stroke="white" strokeWidth="6" />
      <circle cx="118" cy="350" r="14" fill="none" stroke="#f97316" strokeWidth="5" />

      {/* Desna strana */}
      <rect x="910" y="255" width="230" height="190" {...LINE} />
      <circle cx="910" cy="350" r="70" {...LINE} />
      <path d="M1140 100 L 1050 100 A 260 260 0 0 0 1050 600 L 1140 600" {...LINE} />
      <line x1="1100" y1="315" x2="1100" y2="385" stroke="white" strokeWidth="6" />
      <circle cx="1082" cy="350" r="14" fill="none" stroke="#f97316" strokeWidth="5" />
    </svg>
  );
}
