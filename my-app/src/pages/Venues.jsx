import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ShieldCheck } from "lucide-react";
import VenueCard from "../components/VenueCard";
import { VenuesMap } from "../components/LocationMap";
import { API_URL } from "../config";
import { distanceKm, getMyPosition } from "../utils/geo";
import { sportFilters } from "../utils/sports";
import { useAdminStatus } from "../utils/venues";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

const SPORTS = sportFilters("");

const PLACES = [
  { value: "", get label() { return i18n.t("venues.all"); } },
  { value: "false", get label() { return i18n.t("common.outdoors"); } },
  { value: "true", get label() { return i18n.t("common.indoors"); } },
];

const pill = (active) =>
  `pill ${
    active ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-gray-300"
  }`;

function Venues() {
  const { t } = useTranslation();

  const loggedIn = Boolean(localStorage.getItem("token"));
  const { isAdmin, pending, pendingClaims } = useAdminStatus();

  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState("");
  const [indoor, setIndoor] = useState("");
  const [goodOnly, setGoodOnly] = useState(false);
  // "name", "rating" ili "distance" (samo uz "Blizu mene")
  const [sortBy, setSortBy] = useState("name");
  // "Blizu mene": moja lokacija [lat, lng] i radijus u km
  const [myPosition, setMyPosition] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locating, setLocating] = useState(false);

  // Sport, unutra/napolju i ocenu filtrira server
  useEffect(() => {
    const params = new URLSearchParams();

    if (sport) params.set("sport", sport);
    if (indoor) params.set("indoor", indoor);
    if (goodOnly) params.set("min_rating", 4);

    setLoading(true);

    fetch(`${API_URL}/api/venues?${params}`)
      .then((res) => res.json())
      .then((data) => setVenues(data.venues || []))
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [sport, indoor, goodOnly]);

  const toggleNearMe = async () => {
    if (myPosition) {
      setMyPosition(null);
      if (sortBy === "distance") setSortBy("name");
      return;
    }

    setLocating(true);

    try {
      setMyPosition(await getMyPosition());
      setSortBy("distance");
    } catch (error) {
      alert(error.message);
    } finally {
      setLocating(false);
    }
  };

  const distanceOf = (venue) =>
    myPosition
      ? distanceKm(myPosition[0], myPosition[1], venue.latitude, venue.longitude)
      : null;

  // Server vraća po nazivu; ocena i udaljenost se sortiraju ovde
  const sorters = {
    name: () => 0,
    rating: (a, b) =>
      (b.rating_avg ?? 0) - (a.rating_avg ?? 0) || b.rating_count - a.rating_count,
    distance: (a, b) => distanceOf(a) - distanceOf(b),
  };

  const shown = (myPosition ? venues.filter((v) => distanceOf(v) <= radiusKm) : venues)
    .slice()
    .sort(sorters[sortBy]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">

        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">{t("venues.venuesAndHalls")}</h1>
            <p className="hidden sm:block text-gray-600 mt-1">
              {t("venues.whereFootballAndBasketballAre")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link
                to="/tereni/admin"
                className="pill inline-flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50"
              >
                <ShieldCheck size={18} />
                {t("venues.suggestions")}
                {pending + pendingClaims > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pending + pendingClaims}
                  </span>
                )}
              </Link>
            )}

            {loggedIn && (
              <Link
                to="/tereni/predlozi"
                className="pill inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                <Plus size={18} />
                {isAdmin ? t("common.addAVenue") : t("common.suggestAVenue")}
              </Link>
            )}
          </div>
        </div>

        {/* Filteri */}
        <div className="bg-white shadow rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-6 gap-y-3">
          <div className="pill-row">
            {SPORTS.map((s) => (
              <button key={s.value} onClick={() => setSport(s.value)} className={pill(sport === s.value)}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="pill-row items-center">
            {PLACES.map((p) => (
              <button key={p.value} onClick={() => setIndoor(p.value)} className={pill(indoor === p.value)}>
                {p.label}
              </button>
            ))}

            <button onClick={() => setGoodOnly(!goodOnly)} className={pill(goodOnly)}>
              {t("venues.rating4")}
            </button>

            <button onClick={toggleNearMe} disabled={locating} className={pill(Boolean(myPosition))}>
              {locating ? t("common.findingLocation") : t("common.nearMe")}
            </button>

            {myPosition && (
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="border p-2 rounded-xl shrink-0"
              >
                {[2, 5, 10, 25, 50].map((km) => (
                  <option key={km} value={km}>
                    {t("common.withinKm", { km })}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <VenuesMap venues={shown} myPosition={myPosition} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-gray-600">
            {loading ? t("common.loading") : t("venues.venuesFound", { length: shown.length })}
          </p>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border p-2 rounded-xl bg-white"
            aria-label={t("venues.order")}
          >
            <option value="name">{t("venues.byName")}</option>
            <option value="rating">{t("venues.topRated")}</option>
            {myPosition && <option value="distance">{t("venues.nearest")}</option>}
          </select>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {shown.map((venue) => (
            <VenueCard key={venue.id} venue={venue} distance={distanceOf(venue)} />
          ))}

          {!loading && shown.length === 0 && (
            <div className="col-span-full text-center text-gray-600 py-10">
              <p className="text-xl">{t("venues.noVenuesMatchTheSelected")}</p>
              {loggedIn && (
                <p className="mt-2">
                  {t("venues.knowAVenue")}{" "}
                  <Link to="/tereni/predlozi" className="text-green-700 font-semibold hover:underline">
                    {t("venues.suggestIt")}
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Venues;
