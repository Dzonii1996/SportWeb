import { useEffect, useState, useRef } from "react";
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
import { FootballPitch, BasketballCourt, TennisCourt, VolleyballCourt, MountainTrail } from "../components/CourtBackgrounds";
import { useTranslation } from "react-i18next";
import i18n, { locale, sportLabel } from "../i18n";
import { sportEmoji } from "../utils/sports";

// Slajdovi u hero delu: pozadina, tekst i dugme za svaki sport
const HERO_SLIDES = [
  {
    sport: "Fudbal",
    emoji: "⚽",
    get play() { return i18n.t("home.playFootball"); },
    get tagline() { return i18n.t("home.smallSidedFootballFutsalOr"); },
    get cta() { return i18n.t("home.findAFootballGame"); },
    accent: "text-green-300",
    Background: FootballPitch,
  },
  {
    sport: "Košarka",
    emoji: "🏀",
    get play() { return i18n.t("home.playBasketball"); },
    get tagline() { return i18n.t("home.3On3BasketballOr"); },
    get cta() { return i18n.t("home.findABasketballGame"); },
    accent: "text-amber-300",
    Background: BasketballCourt,
  },
  {
    sport: "Tenis",
    emoji: "🎾",
    get play() { return i18n.t("home.playTennis"); },
    get tagline() { return i18n.t("home.tennisTagline"); },
    get cta() { return i18n.t("home.findATennisGame"); },
    accent: "text-lime-300",
    Background: TennisCourt,
  },
  {
    sport: "Odbojka",
    emoji: "🏐",
    get play() { return i18n.t("home.playVolleyball"); },
    get tagline() { return i18n.t("home.volleyballTagline"); },
    get cta() { return i18n.t("home.findAVolleyballGame"); },
    accent: "text-orange-300",
    Background: VolleyballCourt,
  },
  {
    sport: "Planinarenje",
    emoji: "🥾",
    get headline() { return i18n.t("home.goHiking"); },
    get tagline() { return i18n.t("home.hikingTagline"); },
    get cta() { return i18n.t("home.findAHike"); },
    accent: "text-sky-200",
    Background: MountainTrail,
  },
];

const SLIDE_MS = 6000;

const SPORTS = [
  { value: "Fudbal", emoji: "⚽", get text() { return i18n.t("home.smallSidedFootballFutsalOr2"); } },
  { value: "Košarka", emoji: "🏀", get text() { return i18n.t("home.3On3BasketballOr2"); } },
  { value: "Tenis", emoji: "🎾", get text() { return i18n.t("home.tennisText"); } },
  { value: "Odbojka", emoji: "🏐", get text() { return i18n.t("home.volleyballText"); } },
  { value: "Planinarenje", emoji: "🥾", get text() { return i18n.t("home.hikingText"); } },
];

const STEPS = [
  {
    icon: Search,
    get title() { return i18n.t("home.findAGame"); },
    get text() { return i18n.t("home.filterBySportDateAnd"); },
  },
  {
    icon: UserPlus,
    get title() { return i18n.t("common.join"); },
    get text() { return i18n.t("home.grabASpotInOne"); },
  },
  {
    icon: Trophy,
    get title() { return i18n.t("home.playAndRate"); },
    get text() { return i18n.t("home.agreeOnTheDetailsIn"); },
  },
];

const formatDate = (match) =>
  // sr-Latn: bez toga Chrome piše dane i mesece ćirilicom ("чет", "дец")
  matchStart(match.match_date, match.match_time).toLocaleDateString(locale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });


// Kompaktna kartica predstojećeg termina
function UpcomingCard({ match }) {
  const { t } = useTranslation();

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
            <p className="font-bold text-gray-900">{sportLabel(match.sport)}</p>
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
          {free === 0 ? t("home.full") : t("home.free", { free })}
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
          <span>{t("home.players", { players, max_players: match.max_players })}</span>
          <span className="text-green-700 font-semibold opacity-0 group-hover:opacity-100 transition">
            {t("home.details")}
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
  const { t } = useTranslation();

  // Pregled termina sa servera: brojevi, prva tri i sledeći po sportu
  const [summary, setSummary] = useState(null);
  const loggedIn = Boolean(localStorage.getItem("user"));

  // Slajder: sam se smenjuje dok korisnik ne izabere sport.
  // Ko u sistemu ima isključene animacije, nema automatskog smenjivanja.
  const [active, setActive] = useState(0);
  const tabsRef = useRef(null);
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

  // Na telefonu red sa sportovima prati izabrani slajd
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.children[active];

    if (tab) row.scrollLeft = tab.offsetLeft - row.offsetLeft - 16;
  }, [active]);

  const selectSlide = (i) => {
    setActive(i);
    setAutoplay(false);
  };

  const slide = HERO_SLIDES[active];

  useEffect(() => {
    fetch(`${API_URL}/api/matches/summary`)
      .then((res) => res.json())
      .then((data) => setSummary(data.success ? data : {}))
      .catch(() => setSummary({}));
  }, []);

  // Termini koji tek dolaze, najbliži prvi (prva tri)
  const upcoming = summary?.upcoming || [];

  const nextForSport = summary?.next_by_sport?.[slide.sport];

  return (
    <div className="min-h-screen bg-gray-50 font-display">

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

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">

          <div className="min-w-0">
            {/* Izbor sporta: menja pozadinu i zaustavlja smenjivanje */}
            <div ref={tabsRef} className="pill-row mb-6" role="tablist" aria-label="Sport">
              {HERO_SLIDES.map((s, i) => (
                <button
                  key={s.sport}
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => selectSlide(i)}
                  className={`relative overflow-hidden shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                    i === active
                      ? "bg-white text-gray-900 border-white"
                      : "bg-white/10 border-white/30 hover:bg-white/20"
                  }`}
                >
                  {s.emoji} {sportLabel(s.sport)}

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
              {t("home.findATeam")}
              <br />
              {t("home.scheduleAGame")}
              <br />
              <span className={slide.accent}>{slide.headline ?? t("home.play", { play: slide.play })}</span>
            </h1>

            <p className="text-lg text-white/85 max-w-xl mt-6">
              {t("home.noMoreGroupChatsJust")}
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
                {loggedIn ? t("common.createGame") : t("home.createAnAccount")}
              </Link>
            </div>
          </div>

          {/* Sledeći termin za izabrani sport */}
          <div className="hidden lg:block">
            <div className="bg-black/30 border border-white/20 backdrop-blur rounded-3xl p-6 shadow-2xl">
              <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-4">
                {t("home.nextGame", { emoji: slide.emoji, sport: sportLabel(slide.sport) })}
              </p>

              {nextForSport ? (
                <div className="text-gray-900 [&>a]:block">
                  <UpcomingCard match={nextForSport} />
                </div>
              ) : (
                <div className="bg-white/10 rounded-2xl p-6 text-center">
                  <p className="text-5xl mb-3" aria-hidden="true">{slide.emoji}</p>
                  <p className="font-semibold">
                    {t("home.noGamesScheduledAtThe")}
                  </p>
                  <Link
                    to={loggedIn ? "/create-match" : "/register"}
                    className="inline-block mt-4 bg-white text-gray-900 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-100"
                  >
                    {t("home.createTheFirstOne")}
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
            { icon: Calendar, value: summary?.games ?? 0, label: t("home.upcomingGames") },
            { icon: Users, value: summary?.free_spots ?? 0, label: t("home.freeSpots") },
            { icon: MapPin, value: summary?.locations ?? 0, label: t("home.locations") },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="p-4 sm:p-6 text-center">
              <Icon className="mx-auto text-green-600 mb-2" size={24} />
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {summary === null ? "–" : value}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Uskoro */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {t("home.comingUpSoon")}
            </h2>
            <p className="text-gray-500 mt-1">
              {t("home.theNearestGamesWithFree")}
            </p>
          </div>

          <Link
            to="/matches"
            className="hidden sm:inline-flex items-center gap-1 text-green-700 font-semibold hover:underline"
          >
            {t("common.allGames")}
            <ArrowRight size={16} />
          </Link>
        </div>

        {summary === null ? (
          <p className="text-gray-500">{t("common.loading")}</p>
        ) : upcoming.length === 0 ? (
          <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
            <p className="text-lg font-semibold text-gray-800">
              {t("home.noGamesScheduledYet")}
            </p>
            <p className="text-gray-500 mt-1 mb-5">
              {t("home.beTheFirstAndGather")}
            </p>
            <Link
              to={loggedIn ? "/create-match" : "/register"}
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold"
            >
              {t("common.createGame")}
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6">
          {t("home.pickASport")}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {SPORTS.map((s) => {
            const count = summary?.by_sport?.[s.value] ?? 0;

            return (
              <Link
                key={s.value}
                to={`/matches?sport=${encodeURIComponent(s.value)}`}
                className="group last:col-span-2 flex flex-col sm:flex-row items-center gap-2 sm:gap-5 text-center sm:text-left bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 hover:border-green-500 hover:shadow-lg transition"
              >
                <span className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl sm:text-4xl group-hover:scale-110 transition">
                  {s.emoji}
                </span>

                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">{sportLabel(s.value)}</h3>
                  <p className="hidden sm:block text-gray-500 text-sm">{s.text}</p>
                </div>

                <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                  {t("home.gamesCount", { count })}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Kako radi */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6">
          {t("home.howItWorks")}
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
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
          <div className="bg-gray-900 text-white rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold">
                {t("home.readyForYourNextGame")}
              </h2>
              <p className="text-gray-300 mt-2">
                {t("home.signingUpTakesHalfA")}
              </p>
            </div>

            <Link
              to="/register"
              className="bg-green-500 hover:bg-green-400 text-gray-900 px-8 py-4 rounded-xl font-bold whitespace-nowrap transition"
            >
              {t("home.createAnAccount")}
            </Link>
          </div>
        </section>
      )}

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-10 mt-16 border-t text-sm text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>
          © {new Date().getFullYear()} Sport<span className="text-green-600 font-semibold"> KM</span>
        </span>
        <span>{t("home.recreationalSportWithoutTheGroup")}</span>
      </footer>

    </div>
  );
}

export default Home;
