// Pozadine za hero na početnoj strani: fudbalski, košarkaški, teniski i odbojkaški teren i planina u SVG-u.
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

// Tvrda podloga, prave proporcije: 23,77 x 10,97 m, 42 piksela po metru
export function TennisCourt() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tennis-surround" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#166534" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="tennis-court" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#tennis-surround)" />
      <rect x="100" y="120" width="1000" height="460" fill="url(#tennis-court)" />

      {/* Linije za dubl i singl */}
      <rect x="100" y="120" width="1000" height="460" {...LINE} />
      <line x1="100" y1="178" x2="1100" y2="178" {...LINE} />
      <line x1="100" y1="522" x2="1100" y2="522" {...LINE} />

      {/* Servis polja */}
      <line x1="331" y1="178" x2="331" y2="522" {...LINE} />
      <line x1="869" y1="178" x2="869" y2="522" {...LINE} />
      <line x1="331" y1="350" x2="869" y2="350" {...LINE} />

      {/* Oznake sredine na osnovnim linijama */}
      <line x1="100" y1="350" x2="118" y2="350" {...LINE} />
      <line x1="1082" y1="350" x2="1100" y2="350" {...LINE} />

      {/* Mreža sa stubovima */}
      <line x1="600" y1="96" x2="600" y2="604" stroke="rgba(255,255,255,0.35)" strokeWidth="14" />
      <line x1="600" y1="96" x2="600" y2="604" stroke="white" strokeWidth="4" />
      <circle cx="600" cy="96" r="9" fill="white" />
      <circle cx="600" cy="604" r="9" fill="white" />
    </svg>
  );
}

// Dvoranski teren, prave proporcije: 18 x 9 m, 50 piksela po metru
export function VolleyballCourt() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="volley-free-zone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e7490" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="volley-court" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c2410c" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#volley-free-zone)" />
      <rect x="150" y="125" width="900" height="450" fill="url(#volley-court)" />

      {/* Spoljne linije */}
      <rect x="150" y="125" width="900" height="450" {...LINE} />

      {/* Linije napada, 3 m od mreže, sa isprekidanim produžetkom van terena */}
      <line x1="450" y1="125" x2="450" y2="575" {...LINE} />
      <line x1="750" y1="125" x2="750" y2="575" {...LINE} />
      <line x1="450" y1="75" x2="450" y2="125" {...LINE} strokeDasharray="12 12" />
      <line x1="450" y1="575" x2="450" y2="625" {...LINE} strokeDasharray="12 12" />
      <line x1="750" y1="75" x2="750" y2="125" {...LINE} strokeDasharray="12 12" />
      <line x1="750" y1="575" x2="750" y2="625" {...LINE} strokeDasharray="12 12" />

      {/* Zone servisa iza osnovnih linija */}
      <line x1="125" y1="125" x2="150" y2="125" {...LINE} />
      <line x1="125" y1="575" x2="150" y2="575" {...LINE} />
      <line x1="1050" y1="125" x2="1075" y2="125" {...LINE} />
      <line x1="1050" y1="575" x2="1075" y2="575" {...LINE} />

      {/* Mreža sa stubovima */}
      <line x1="600" y1="90" x2="600" y2="610" stroke="rgba(255,255,255,0.35)" strokeWidth="14" />
      <line x1="600" y1="90" x2="600" y2="610" stroke="white" strokeWidth="4" />
      <circle cx="600" cy="90" r="9" fill="white" />
      <circle cx="600" cy="610" r="9" fill="white" />
    </svg>
  );
}

// Planinski vrhovi u slojevima i obeležena staza do vrha
export function MountainTrail() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hike-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0369a1" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#hike-sky)" />
      <circle cx="930" cy="130" r="58" fill="#fde68a" />

      {/* Daleki vrhovi */}
      <path d="M0 430 180 240 330 380 520 170 700 360 860 220 1040 370 1200 260V700H0Z" fill="#64748b" />
      <path d="M520 170 575 228 545 245 515 222 482 250 462 232Z" fill="#f8fafc" />
      <path d="M860 220 902 256 878 270 856 252 830 272 812 262Z" fill="#f8fafc" />

      {/* Bliži vrhovi i šuma */}
      <path d="M0 520 220 360 400 490 640 300 860 480 1040 390 1200 500V700H0Z" fill="#166534" />
      <path d="M0 610 260 500 520 590 800 480 1200 610V700H0Z" fill="#14532d" />

      {/* Staza do vrha */}
      <path
        d="M170 700C260 620 430 640 520 570S640 470 700 450 620 380 640 300"
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="5"
        strokeDasharray="16 14"
        strokeLinecap="round"
      />
      <path d="M640 300V248L684 262 640 276" fill="#ef4444" stroke="white" strokeWidth="3" />
    </svg>
  );
}
