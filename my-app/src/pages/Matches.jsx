


import { useState, useEffect } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import MatchCard from "../components/MatchCard";
import axios from "axios";
import { API_URL } from "../config";
import {
  localDateKey,
  isPastMatch,
  normalizeText,
} from "../utils/matchDate";
import { distanceKm, getMyPosition, hasCoords } from "../utils/geo";
import { sportFilters } from "../utils/sports";
import { useTranslation } from "react-i18next";

const SPORTS = sportFilters("Svi");

function Matches() {
  const { t } = useTranslation();

  // Sport može doći iz linka sa početne strane: /matches?sport=Fudbal
  const [searchParams] = useSearchParams();
  const sportParam = searchParams.get("sport");

  const [selectedSport, setSelectedSport] = useState(
    SPORTS.some((s) => s.value === sportParam) ? sportParam : "Svi"
  );
  const [selectedDate, setSelectedDate] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [showPast, setShowPast] = useState(false);
  // "Blizu mene": moja lokacija [lat, lng] i radijus u km
  const [myPosition, setMyPosition] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locating, setLocating] = useState(false);
  // Na telefonu su dodatni filteri sklopljeni
  const [moreOpen, setMoreOpen] = useState(false);


 const [matches, setMatches] = useState([]);


useEffect(() => {
  fetchMatches();
}, []);

const fetchMatches = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/api/matches`
    );

    setMatches(response.data.matches);

  } catch (error) {
    console.error(error);
  }
};

  const search = normalizeText(locationQuery.trim());

  const toggleNearMe = async () => {
    if (myPosition) {
      setMyPosition(null);
      return;
    }

    setLocating(true);

    try {
      setMyPosition(await getMyPosition());
    } catch (error) {
      alert(error.message);
    } finally {
      setLocating(false);
    }
  };

  // Udaljenost termina od mene, null ako termin nema tačku na mapi
  const distanceOf = (match) =>
    myPosition && hasCoords(match)
      ? distanceKm(myPosition[0], myPosition[1], match.latitude, match.longitude)
      : null;

 const filteredMatches = matches.filter((match) => {
  const sportFilter =
    selectedSport === "Svi" || match.sport === selectedSport;

  const dateFilter =
    selectedDate === "" ||
    localDateKey(match.match_date) === selectedDate;

  const availableFilter =
    !onlyAvailable ||
    Number(match.players) < Number(match.max_players);

  const locationFilter =
    search === "" ||
    normalizeText(match.location).includes(search);

  const pastFilter =
    showPast || !isPastMatch(match.match_date, match.match_time);

  const distance = distanceOf(match);
  const nearFilter =
    !myPosition || (distance !== null && distance <= radiusKm);

  return (
    sportFilter &&
    dateFilter &&
    availableFilter &&
    locationFilter &&
    pastFilter &&
    nearFilter
  );
});

  // Uz "Blizu mene" najbliži termini idu prvi
  if (myPosition) {
    filteredMatches.sort((a, b) => distanceOf(a) - distanceOf(b));
  }

  const hasFilters =
    selectedSport !== "Svi" ||
    selectedDate !== "" ||
    onlyAvailable ||
    locationQuery !== "" ||
    showPast ||
    myPosition !== null;

  // Koliko je dodatnih filtera uključeno (broj na sklopljenom dugmetu)
  const extraFilters = [selectedDate !== "", onlyAvailable, showPast, myPosition !== null].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedSport("Svi");
    setSelectedDate("");
    setOnlyAvailable(false);
    setLocationQuery("");
    setShowPast(false);
    setMyPosition(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="max-w-7xl mx-auto p-4 sm:p-6">

        <h1 className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-8">
          {t("matches.sportsGames")}
        </h1>

        {/* Filteri */}

        <div className="bg-white shadow rounded-2xl p-4 sm:p-6 mb-4 sm:mb-8 space-y-3 sm:space-y-4">

          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">

            <div className="pill-row">
              {SPORTS.map((sport) => (
                <button
                  key={sport.value}
                  onClick={() => setSelectedSport(sport.value)}
                  className={`pill ${
                    selectedSport === sport.value
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  {sport.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={t("matches.searchByLocation")}
                className="w-full border p-3 pl-10 rounded-xl"
              />
            </div>

          </div>

          <button
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            className="sm:hidden w-full flex items-center gap-2 font-semibold text-gray-700"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {t("matches.moreFilters")}

            {extraFilters > 0 && (
              <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                {extraFilters}
              </span>
            )}

            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`ml-auto transition ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div className={`${moreOpen ? "flex" : "hidden"} sm:flex flex-wrap items-center gap-x-6 gap-y-3`}>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border p-3 rounded-xl w-full sm:w-auto"
            />

            <label className="flex items-center gap-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={() => setOnlyAvailable(!onlyAvailable)}
                className="w-4 h-4"
              />
              {t("matches.onlyWithFreeSpots")}
            </label>

            <label className="flex items-center gap-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={showPast}
                onChange={() => setShowPast(!showPast)}
                className="w-4 h-4"
              />
              {t("matches.alsoShowPlayedGames")}
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleNearMe}
                disabled={locating}
                className={`pill ${
                  myPosition
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {locating ? t("common.findingLocation") : t("common.nearMe")}
              </button>

              {myPosition && (
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="border p-2 rounded-xl"
                >
                  {[2, 5, 10, 25, 50].map((km) => (
                    <option key={km} value={km}>
                      {t("common.withinKm", { km })}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-green-700 hover:underline font-medium"
              >
                {t("matches.clearFilters")}
              </button>
            )}

          </div>

        </div>

        <p className="text-gray-600 mb-4">
          {t("matches.gamesFound", { length: filteredMatches.length })}
          {myPosition && t("matches.showingOnlyGamesMarkedOn")}
        </p>

        {/* Kartice */}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">

          {filteredMatches.length > 0 ? (
            filteredMatches.map((match) => (
              <MatchCard
                key={match.id}
  id={match.id}
  creatorId={match.user_id}
    creatorAvatar={match.creator_avatar}
creatorName={match.creator_name}
  sport={match.sport}
  location={match.location}
  date={match.match_date}
  time={match.match_time}
  players={Number(match.players || 0)}
  maxPlayers={match.max_players}
  isPast={isPastMatch(match.match_date, match.match_time)}
  distance={distanceOf(match)}
  repeatWeekly={match.repeat_weekly}
  fieldPrice={match.field_price}
  scoreA={match.score_a}
  scoreB={match.score_b}
              />
            ))
          ) : (
            <div className="col-span-full text-center text-gray-600 text-xl">
              {t("matches.noGamesMatchTheSelected")}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default Matches;
