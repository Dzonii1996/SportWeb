import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  UserPlus,
  Trophy,
  MapPin,
  Calendar,
  Users,
  ArrowRight,
} from "lucide-react";
import { API_URL } from "../config";
import { isPastMatch, matchStart } from "../utils/matchDate";
import { FootballPitch, BasketballCourt } from "../components/CourtBackgrounds";

// Slajdovi u hero delu: pozadina, tekst i dugme za svaki sport
const HERO_SLIDES = [
  {
    sport: "Fudbal",
    emoji: "⚽",
    play: "fudbal",
    tagline: "Mali fudbal, futsal i veliki teren u tvom gradu",
    cta: "Pronađi fudbalski termin",
    accent: "text-green-300",
    Background: FootballPitch,
  },
  {
    sport: "Košarka",
    emoji: "🏀",
    play: "basket",
    tagline: "Basket 3 na 3 ili puna ekipa u tvom gradu",
    cta: "Pronađi košarkaški termin",
    accent: "text-amber-300",
    Background: BasketballCourt,
  },
];

const SLIDE_MS = 6000;

const SPORTS = [
  { value: "Fudbal", emoji: "⚽", text: "Mali fudbal, futsal ili veliki teren" },
  { value: "Košarka", emoji: "🏀", text: "Basket 3 na 3 ili puna ekipa" },
];

const STEPS = [
  {
    icon: Search,
    title: "Pronađi termin",
    text: "Filtriraj po sportu, datumu i lokaciji ili vidi šta se igra blizu tebe.",
  },
  {
    icon: UserPlus,
    title: "Prijavi se",
    text: "Zauzmi mesto jednim klikom. Ako je pun, upiši se na listu čekanja.",
  },
  {
    icon: Trophy,
    title: "Igraj i oceni",
    text: "Dogovori detalje u četu, odigraj i oceni fer plej saigrača.",
  },
];

const formatDate = (match) =>
  // sr-Latn: bez toga Chrome piše dane i mesece ćirilicom ("чет", "дец")
  matchStart(match.match_date, match.match_time).toLocaleDateString("sr-Latn-RS", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const sportEmoji = (sport) => (sport === "Košarka" ? "🏀" : "⚽");

// Kompaktna kartica predstojećeg termina
function UpcomingCard({ match }) {
  const players = Number(match.players || 0);
  const free = Math.max(0, match.max_players - players);
  const percentage = Math.min(100, (players / match.max_players) * 100);

  return (
    <Link
      to={`/matches/${match.id}`}
      className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-green-500 hover:shadow-lg transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-2xl">
            {sportEmoji(match.sport)}
          </span>

          <div>
            <p className="font-bold text-gray-900">{match.sport}</p>
            <p className="text-sm text-gray-500">{match.creator_name}</p>
          </div>
        </div>

        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            free === 0
              ? "bg-orange-100 text-orange-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {free === 0 ? "Popunjeno" : `${free} slobodno`}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-gray-600">
        <p className="flex items-center gap-2">
          <Calendar size={16} className="text-green-600" />
          {formatDate(match)} • {match.match_time?.slice(0, 5)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin size={16} className="text-green-600" />
          <span className="truncate">{match.location}</span>
        </p>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{players} / {match.max_players} igrača</span>
          <span className="text-green-700 font-semibold opacity-0 group-hover:opacity-100 transition">
            Detalji →
          </span>
        </div>

        <div className="h-2 bg-gray-100 rounded-full">
          <div
            className="h-2 bg-green-500 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function Home() {
  const [matches, setMatches] = useState(null);
  const loggedIn = Boolean(localStorage.getItem("user"));

  // Slajder: sam se smenjuje dok korisnik ne izabere sport.
  // Ko u sistemu ima isključene animacije, nema automatskog smenjivanja.
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [autoplay, setAutoplay] = useState(
    () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (!autoplay) return;

    const timer = setTimeout(() => {
      setActive((i) => (i + 1) % HERO_SLIDES.length);
      setCycle((c) => c + 1);
    }, SLIDE_MS);

    return () => clearTimeout(timer);
  }, [autoplay, active, cycle]);

  const selectSlide = (i) => {
    setActive(i);
    setAutoplay(false);
  };

  const slide = HERO_SLIDES[active];

  useEffect(() => {
    fetch(`${API_URL}/api/matches`)
      .then((res) => res.json())
      .then((data) => setMatches(data.matches || []))
      .catch(() => setMatches([]));
  }, []);

  // Samo termini koji tek dolaze, najbliži prvi
  const upcoming = (matches || [])
    .filter((m) => !isPastMatch(m.match_date, m.match_time))
    .sort(
      (a, b) =>
        matchStart(a.match_date, a.match_time) -
        matchStart(b.match_date, b.match_time)
    );

  const freeSpots = upcoming.reduce(
    (sum, m) => sum + Math.max(0, m.max_players - Number(m.players || 0)),
    0
  );

  const locations = new Set(
    upcoming.map((m) => m.location.trim().toLowerCase())
  ).size;

  const nextForSport = upcoming.find((m) => m.sport === slide.sport);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero: pozadina se smenjuje između terena, ili prati izabrani sport */}
      <section className="relative overflow-hidden text-white bg-green-800">

        {HERO_SLIDES.map(({ sport, Background }, i) => (
          <div
            key={sport}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <Background />
          </div>
        ))}

        {/* Zatamnjenje, da tekst bude čitljiv preko linija terena */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">

          <div>
            {/* Izbor sporta: menja pozadinu i zaustavlja smenjivanje */}
            <div className="flex gap-2 mb-6" role="tablist" aria-label="Sport">
              {HERO_SLIDES.map((s, i) => (
                <button
                  key={s.sport}
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => selectSlide(i)}
                  className={`relative overflow-hidden px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                    i === active
                      ? "bg-white text-gray-900 border-white"
                      : "bg-white/10 border-white/30 hover:bg-white/20"
                  }`}
                >
                  {s.emoji} {s.sport}

                  {/* Traka do sledećeg slajda, dok se smenjuju sami */}
                  {autoplay && i === active && (
                    <span
                      key={`${active}-${cycle}`}
                      className="absolute left-0 bottom-0 h-0.5 bg-green-600"
                      style={{ animation: `hero-progress ${SLIDE_MS}ms linear forwards` }}
                    />
                  )}
                </button>
              ))}
            </div>

            <span className="inline-block bg-white/15 border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              {slide.tagline}
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              Pronađi ekipu.
              <br />
              Zakaži termin.
              <br />
              <span className={slide.accent}>Igraj {slide.play}.</span>
            </h1>

            <p className="text-lg text-white/85 max-w-xl mt-6">
              Više nema dopisivanja po grupama da bi se skupilo deset ljudi.
              Napravi termin, podeli link i neka se ekipa sama prijavi.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to={`/matches?sport=${encodeURIComponent(slide.sport)}`}
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-100 transition"
              >
                {slide.cta}
                <ArrowRight size={18} />
              </Link>

              <Link
                to={loggedIn ? "/create-match" : "/register"}
                className="inline-flex items-center gap-2 border-2 border-white/70 px-6 py-3.5 rounded-xl font-bold hover:bg-white hover:text-gray-900 transition"
              >
                {loggedIn ? "Kreiraj termin" : "Napravi nalog"}
              </Link>
            </div>
          </div>

          {/* Sledeći termin za izabrani sport */}
          <div className="hidden lg:block">
            <div className="bg-black/30 border border-white/20 backdrop-blur rounded-3xl p-6 shadow-2xl">
              <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-4">
                Sledeći termin · {slide.emoji} {slide.sport}
              </p>

              {nextForSport ? (
                <div className="text-gray-900 [&>a]:block">
                  <UpcomingCard match={nextForSport} />
                </div>
              ) : (
                <div className="bg-white/10 rounded-2xl p-6 text-center">
                  <p className="text-5xl mb-3" aria-hidden="true">{slide.emoji}</p>
                  <p className="font-semibold">
                    Trenutno nema zakazanih termina.
                  </p>
                  <Link
                    to={loggedIn ? "/create-match" : "/register"}
                    className="inline-block mt-4 bg-white text-gray-900 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-100"
                  >
                    Napravi prvi
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Brojevi */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-10 relative">
        <div className="grid grid-cols-3 bg-white rounded-2xl shadow-xl border divide-x">
          {[
            { icon: Calendar, value: upcoming.length, label: "Predstojećih termina" },
            { icon: Users, value: freeSpots, label: "Slobodnih mesta" },
            { icon: MapPin, value: locations, label: "Lokacija" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="p-4 sm:p-6 text-center">
              <Icon className="mx-auto text-green-600 mb-2" size={24} />
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {matches === null ? "–" : value}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Uskoro */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Uskoro se igra
            </h2>
            <p className="text-gray-500 mt-1">
              Najbliži termini sa slobodnim mestima
            </p>
          </div>

          <Link
            to="/matches"
            className="hidden sm:inline-flex items-center gap-1 text-green-700 font-semibold hover:underline"
          >
            Svi termini
            <ArrowRight size={16} />
          </Link>
        </div>

        {matches === null ? (
          <p className="text-gray-500">Učitavanje...</p>
        ) : upcoming.length === 0 ? (
          <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
            <p className="text-lg font-semibold text-gray-800">
              Još nema zakazanih termina.
            </p>
            <p className="text-gray-500 mt-1 mb-5">
              Budi prvi i okupi ekipu.
            </p>
            <Link
              to={loggedIn ? "/create-match" : "/register"}
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold"
            >
              Kreiraj termin
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcoming.slice(0, 3).map((m) => (
              <UpcomingCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>

      {/* Sportovi */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6">
          Izaberi sport
        </h2>

        <div className="grid sm:grid-cols-2 gap-5">
          {SPORTS.map((s) => {
            const count = upcoming.filter((m) => m.sport === s.value).length;

            return (
              <Link
                key={s.value}
                to={`/matches?sport=${encodeURIComponent(s.value)}`}
                className="group flex items-center gap-5 bg-white rounded-2xl border border-gray-200 p-6 hover:border-green-500 hover:shadow-lg transition"
              >
                <span className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-4xl group-hover:scale-110 transition">
                  {s.emoji}
                </span>

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{s.value}</h3>
                  <p className="text-gray-500 text-sm">{s.text}</p>
                </div>

                <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                  {count} {count === 1 ? "termin" : "termina"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Kako radi */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6">
          Kako radi
        </h2>

        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                <Icon className="text-green-600" size={22} />
              </div>

              <h3 className="font-bold text-lg text-gray-900">{title}</h3>
              <p className="text-gray-600 mt-1">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Poziv na akciju */}
      {!loggedIn && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
          <div className="bg-gray-900 text-white rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold">
                Spreman za sledeću utakmicu?
              </h2>
              <p className="text-gray-300 mt-2">
                Registracija traje pola minuta.
              </p>
            </div>

            <Link
              to="/register"
              className="bg-green-500 hover:bg-green-400 text-gray-900 px-8 py-4 rounded-xl font-bold whitespace-nowrap transition"
            >
              Napravi nalog
            </Link>
          </div>
        </section>
      )}

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-10 mt-16 border-t text-sm text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>
          © {new Date().getFullYear()} Sport<span className="text-green-600 font-semibold">Web</span>
        </span>
        <span>Rekreativni sport, bez dopisivanja.</span>
      </footer>

    </div>
  );
}

export default Home;
