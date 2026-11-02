import { MapPin, Calendar, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authHeader } from "../utils/auth";
import { API_URL } from "../config";
import { formatDistance } from "../utils/geo";


function MatchCard({
  id,
  creatorId,
    creatorAvatar,
  creatorName,

  sport,
  location,
  date,
  time,
  players,
  maxPlayers,
  isPast = false,
  distance = null,
}) {
  const [showPlayers, setShowPlayers] = useState(false);
const [playersList, setPlayersList] = useState([]);
  const [joined, setJoined] = useState(false);

  const percentage = (players / maxPlayers) * 100;
  const isFull = Number(players) >= Number(maxPlayers);
  // Odigran ili pun termin prikazujemo prigušeno
  const inactive = isFull || isPast;
  const formattedDate = new Date(date).toLocaleDateString("sr-RS");

  useEffect(() => {
    const checkJoined = async () => {
      const user = JSON.parse(localStorage.getItem("user"));

      if (!user) return;

      try {
        const res = await fetch(
          `${API_URL}/api/matches/${id}/players`
        );

        const data = await res.json();

        const exists = data.players.some(
          (player) => player.id === user.id
        );

        setJoined(exists);

      } catch (error) {
        console.error(error);
      }
    };

    if (id) {
      checkJoined();
    }
  }, [id]);

  const joinMatch = async () => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      alert("Morate biti prijavljeni.");
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({
            user_id: user.id,
          }),
        }
      );

      const data = await res.json();

      alert(data.message);

      if (data.success) {
        setJoined(true);
        window.location.reload();
      }

    } catch (error) {
      console.error(error);
    }
  };

  const leaveMatch = async () => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) return;

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}/leave`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({
            user_id: user.id,
          }),
        }
      );

      const data = await res.json();

      alert(data.message);

      if (data.success) {
        setJoined(false);
        window.location.reload();
      }

    } catch (error) {
      console.error(error);
    }
  };
  const deleteMatch = async () => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return;

  const confirmDelete = window.confirm(
    "Da li ste sigurni da želite da obrišete termin?"
  );

  if (!confirmDelete) return;

  try {
    const res = await fetch(
      `${API_URL}/api/matches/${id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({
          user_id: user.id,
        }),
      }
    );

    const data = await res.json();

    alert(data.message);

    if (data.success) {
      window.location.reload();
    }

  } catch (error) {
    console.error(error);
  }
};
const getPlayers = async () => {
  try {
    const res = await fetch(
      `${API_URL}/api/matches/${id}/players`
    );

    const data = await res.json();

setPlayersList(data.players || []);    
setShowPlayers(true);

  } catch (error) {
    console.error(error);
  }
};

  return (
<div
  className={`rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden ${
    inactive ? "bg-gray-100 opacity-80" : "bg-white"
  }`}
>
  <div
    className={`text-white p-5 ${
      inactive ? "bg-gray-500" : "bg-green-600"
    }`}
  >
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold">
        {sport === "Fudbal" ? "⚽ Fudbal" : "🏀 Košarka"}
      </h2>

      {isPast ? (
        <span className="bg-gray-700 px-3 py-1 rounded-full text-sm font-bold">
          ODIGRAN
        </span>
      ) : isFull && (
        <span className="bg-red-600 px-3 py-1 rounded-full text-sm font-bold">
          POPUNJENO
        </span>
      )}
    </div>

    {/* Kreator termina */}
    
  {/* Kreator termina */}

<Link
  to={`/users/${creatorId}`}
  className="flex items-center gap-3 mt-4 hover:opacity-80 transition"
>
  {creatorAvatar ? (
    <img
      src={`${API_URL}${creatorAvatar}`}
      alt={creatorName}
      className="w-12 h-12 rounded-full object-cover border-2 border-white"
    />
  ) : (
    <div className="w-12 h-12 rounded-full bg-white text-green-600 flex items-center justify-center font-bold text-xl">
      {creatorName?.charAt(0).toUpperCase()}
    </div>
  )}

  <div>
    <p className="text-sm text-green-100">
      Kreirao
    </p>

    <p className="font-bold">
      {creatorName || "Nepoznat korisnik"}
    </p>
  </div>
</Link>

    <p className="text-green-100 mt-3">
      Rekreativni termin
    </p>
  </div>
      <div className="p-5 space-y-4">

        <div className="flex items-center gap-3">
          <MapPin className="text-green-600" size={20} />
          <span>{location}</span>

          {distance !== null && (
            <span className="ml-auto text-sm text-green-700 font-semibold whitespace-nowrap">
              {formatDistance(distance)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="text-green-600" size={20} />
          <span>{formattedDate} • {time}</span>
        </div>

        <div className="flex items-center gap-3">
          <Users className="text-green-600" size={20} />
          <span>{players} / {maxPlayers} igrača</span>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Popunjenost</span>
            <span>{Math.round(percentage)}%</span>
          </div>

          <div className="w-full h-3 bg-gray-200 rounded-full">
            <div
              className="h-3 bg-green-600 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {isFull && !joined && !isPast ? (
          // Pun termin: lista čekanja je na stranici termina
          <Link
            to={`/matches/${id}`}
            className="block w-full text-center py-3 rounded-xl font-semibold transition bg-orange-500 hover:bg-orange-600 text-white"
          >
            ⏳ Popunjeno — lista čekanja
          </Link>
        ) : (
        <button
          onClick={joined ? leaveMatch : joinMatch}
          className={`w-full py-3 rounded-xl font-semibold transition ${
            isPast
              ? "bg-gray-400 cursor-not-allowed text-white"
              : joined
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          disabled={isPast}
        >

          {isPast
            ? "Termin je odigran"
            : joined
            ? "Napusti termin"
            : "Prijavi se"}
        </button>
        )}
        <button
  onClick={getPlayers}
  className="w-full mt-3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
>
  👥 Pogledaj učesnike
</button>
<Link
  to={`/matches/${id}`}
  className="block w-full mt-3 text-center py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
>
  💬 Detalji i čet
</Link>
        
{JSON.parse(localStorage.getItem("user"))?.id === creatorId && (
  <button
    onClick={deleteMatch}
    className="w-full mt-3 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold"
  >
    🗑 Obriši termin
  </button>
  
)}
{JSON.parse(localStorage.getItem("user"))?.id === creatorId && (
  <Link
    to={`/matches/${id}/edit`}
    className="block w-full mt-3 text-center py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold"
  >
    ✏️ Izmeni termin
  </Link>
)}
      </div>
      {showPlayers && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-96">

      <h2 className="text-2xl font-bold mb-4">
        Prijavljeni igrači
      </h2>

      {playersList.length > 0 ? (
        playersList.map((player) => (
          <div key={player.id} className="border-b py-2">
            <p className="font-semibold">{player.name}</p>
            <p className="text-gray-500 text-sm">
              {player.email}
            </p>
          </div>
        ))
      ) : (
        <p>Nema prijavljenih igrača.</p>
      )}

      <button
        onClick={() => setShowPlayers(false)}
        className="mt-5 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl"
      >
        Zatvori
      </button>

    </div>
  </div>
)}

    </div>
  );
}

export default MatchCard;