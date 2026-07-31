import { MapPin, Calendar, Users } from "lucide-react";

<MatchCard
  key={match.id}
  sport={match.sport}
  location={match.location}
  date={match.match_date}
  time={match.match_time}
  players={0}
  maxPlayers={match.max_players}
/>
  const percentage = (players / maxPlayers) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden">

      {/* Zaglavlje */}
      <div className="bg-green-600 text-white p-5">
        <h2 className="text-2xl font-bold">
          {sport === "Fudbal" ? "⚽ Fudbal" : "🏀 Košarka"}
        </h2>

        <p className="text-green-100 mt-1">
          Rekreativni termin
        </p>
      </div>

      {/* Sadržaj */}
      <div className="p-5 space-y-4">

        <div className="flex items-center gap-3">
          <MapPin className="text-green-600" size={20} />
          <span>{location}</span>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="text-green-600" size={20} />
          <span>{date} • {time}</span>
        </div>

        <div className="flex items-center gap-3">
          <Users className="text-green-600" size={20} />
          <span>{players} / {maxPlayers} igrača</span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Popunjenost</span>
            <span>{Math.round(percentage)}%</span>
          </div>

          <div className="w-full h-3 bg-gray-200 rounded-full">
            <div
              className="h-3 bg-green-600 rounded-full"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Dugme */}
        <button
          className={`w-full py-3 rounded-xl font-semibold transition ${
            players >= maxPlayers
              ? "bg-gray-400 cursor-not-allowed text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          disabled={players >= maxPlayers}
        >
          {players >= maxPlayers ? "Termin popunjen" : "Prijavi se"}
        </button>

      </div>

    </div>
  );
}

export default MatchCard;
