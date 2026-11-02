

import { useState, useEffect } from "react";
import MatchCard from "../components/MatchCard";
import axios from "axios";

function Matches() {
  const [selectedSport, setSelectedSport] = useState("Svi");
  const [selectedDate, setSelectedDate] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);


 const [matches, setMatches] = useState([]);


useEffect(() => {
  fetchMatches();
}, []);

const fetchMatches = async () => {
  try {
    const response = await axios.get(
      "http://localhost:5000/api/matches"
    );

    setMatches(response.data.matches);

  } catch (error) {
    console.error(error);
  }
};

 const filteredMatches = matches.filter((match) => {
  const sportFilter =
    selectedSport === "Svi" || match.sport === selectedSport;

  const dateFilter =
    selectedDate === "" ||
    match.match_date.slice(0, 10) === selectedDate;

  const availableFilter =
    !onlyAvailable ||
    Number(match.players) < Number(match.max_players);

  return (
    sportFilter &&
    dateFilter &&
    availableFilter
  );
});

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="max-w-7xl mx-auto p-6">

        <h1 className="text-4xl font-bold mb-8">
          Sportski termini
        </h1>

        {/* Filteri */}

        <div className="bg-white shadow rounded-2xl p-6 mb-8">

          <div className="grid md:grid-cols-2 gap-4">

            <div className="flex flex-wrap gap-3">

  <button
    onClick={() => setSelectedSport("Svi")}
    className={`px-5 py-2 rounded-full font-semibold transition ${
      selectedSport === "Svi"
        ? "bg-green-600 text-white"
        : "bg-gray-200 hover:bg-gray-300"
    }`}
  >
    Svi
  </button>

  <button
    onClick={() => setSelectedSport("Fudbal")}
    className={`px-5 py-2 rounded-full font-semibold transition ${
      selectedSport === "Fudbal"
        ? "bg-green-600 text-white"
        : "bg-gray-200 hover:bg-gray-300"
    }`}
  >
    ⚽ Fudbal
  </button>

  <button
    onClick={() => setSelectedSport("Košarka")}
    className={`px-5 py-2 rounded-full font-semibold transition ${
      selectedSport === "Košarka"
        ? "bg-green-600 text-white"
        : "bg-gray-200 hover:bg-gray-300"
    }`}
  >
    🏀 Košarka
  </button>

</div>
            
          

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border p-3 rounded-xl"
            />
            <div className="flex items-center gap-2 mt-4">
  <input
    type="checkbox"
    id="available"
    checked={onlyAvailable}
    onChange={() => setOnlyAvailable(!onlyAvailable)}
    className="w-4 h-4"
  />

  <label htmlFor="available" className="font-medium cursor-pointer">
    👥 Prikaži samo termine sa slobodnim mestima
  </label>
</div>

          </div>

        </div>

        {/* Kartice */}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

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
              />
            ))
          ) : (
            <div className="col-span-3 text-center text-gray-600 text-xl">
              Nema dostupnih termina.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default Matches;