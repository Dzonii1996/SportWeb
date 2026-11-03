import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ShieldCheck } from "lucide-react";
import VenueCard from "../components/VenueCard";
import { VenuesMap } from "../components/LocationMap";
import { API_URL } from "../config";
import { distanceKm, getMyPosition } from "../utils/geo";
import { useAdminStatus } from "../utils/venues";

const SPORTS = [
  { value: "", label: "Svi" },
  { value: "Fudbal", label: "⚽ Fudbal" },
  { value: "Košarka", label: "🏀 Košarka" },
];

const PLACES = [
  { value: "", label: "Sve" },
  { value: "false", label: "🌤️ Napolju" },
  { value: "true", label: "🏠 Unutra" },
];

const pill = (active) =>
  `px-4 py-2 rounded-full font-semibold transition ${
    active ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-gray-300"
  }`;

function Venues() {
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
      <div className="max-w-7xl mx-auto p-6">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold">Tereni i sale</h1>
            <p className="text-gray-600 mt-1">
              Gde se igra fudbal i košarka: adrese, podloga, cene i zakazani termini.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link
                to="/tereni/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold border border-gray-300 bg-white hover:bg-gray-50"
              >
                <ShieldCheck size={18} />
                Predlozi
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
                className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-semibold shadow-sm"
              >
                <Plus size={18} />
                {isAdmin ? "Dodaj teren" : "Predloži teren"}
              </Link>
            )}
          </div>
        </div>

        {/* Filteri */}
        <div className="bg-white shadow rounded-2xl p-6 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <button key={s.value} onClick={() => setSport(s.value)} className={pill(sport === s.value)}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {PLACES.map((p) => (
              <button key={p.value} onClick={() => setIndoor(p.value)} className={pill(indoor === p.value)}>
                {p.label}
              </button>
            ))}
          </div>

          <button onClick={() => setGoodOnly(!goodOnly)} className={pill(goodOnly)}>
            ⭐ Ocena 4+
          </button>

          <div className="flex items-center gap-2">
            <button onClick={toggleNearMe} disabled={locating} className={pill(Boolean(myPosition))}>
              {locating ? "Tražim lokaciju..." : "📍 Blizu mene"}
            </button>

            {myPosition && (
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="border p-2 rounded-xl"
              >
                {[2, 5, 10, 25, 50].map((km) => (
                  <option key={km} value={km}>
                    do {km} km
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mb-6">
          <VenuesMap venues={shown} myPosition={myPosition} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-gray-600">
            {loading ? "Učitavanje..." : `Pronađeno terena: ${shown.length}`}
          </p>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border p-2 rounded-xl bg-white"
            aria-label="Redosled"
          >
            <option value="name">Po nazivu</option>
            <option value="rating">Najbolje ocenjeni</option>
            {myPosition && <option value="distance">Najbliži</option>}
          </select>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((venue) => (
            <VenueCard key={venue.id} venue={venue} distance={distanceOf(venue)} />
          ))}

          {!loading && shown.length === 0 && (
            <div className="col-span-full text-center text-gray-600 py-10">
              <p className="text-xl">Nema terena za izabrane filtere.</p>
              {loggedIn && (
                <p className="mt-2">
                  Znaš neki teren?{" "}
                  <Link to="/tereni/predlozi" className="text-green-700 font-semibold hover:underline">
                    Predloži ga
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
