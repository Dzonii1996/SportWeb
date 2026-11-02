import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapPin, Calendar, Users, ArrowLeft } from "lucide-react";
import MatchChat from "../components/MatchChat";
import MatchRatings from "../components/MatchRatings";
import RegularSpot from "../components/RegularSpot";
import { LocationView } from "../components/LocationMap";
import { hasCoords } from "../utils/geo";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { isPastMatch } from "../utils/matchDate";

function Avatar({ name, avatar, size = "w-10 h-10", text = "text-lg" }) {
  return avatar ? (
    <img
      src={`${API_URL}${avatar}`}
      alt={name}
      className={`${size} rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${size} ${text} rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold`}
    >
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

function MatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadMatch = useCallback(async () => {
    try {
      const [matchRes, playersRes, waitlistRes] = await Promise.all([
        fetch(`${API_URL}/api/matches/${id}`),
        fetch(`${API_URL}/api/matches/${id}/players`),
        fetch(`${API_URL}/api/matches/${id}/waitlist`),
      ]);

      if (matchRes.status === 404) {
        setNotFound(true);
        return;
      }

      const matchData = await matchRes.json();
      const playersData = await playersRes.json();
      const waitlistData = await waitlistRes.json();

      setMatch(matchData.match);
      setPlayers(playersData.players || []);
      setWaitlist(waitlistData.waitlist || []);

    } catch (error) {
      console.error(error);
    }
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  // Otvaranjem stranice notifikacije za ovaj termin su viđene
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    fetch(`${API_URL}/api/notifications/match/${id}/read`, {
      method: "PUT",
      headers: authHeader(),
    }).catch(console.error);
  }, [id, userId]);

  if (notFound) {
    return (
      <div className="text-center mt-20">
        <p className="text-xl mb-4">Termin ne postoji.</p>

        <Link to="/matches" className="text-green-600 hover:underline">
          Nazad na termine
        </Link>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center mt-20 text-xl">
        Učitavanje...
      </div>
    );
  }

  const isCreator = user?.id === match.user_id;
  const joined = players.some((p) => p.id === user?.id);
  const isFull = players.length >= Number(match.max_players);
  const isPast = isPastMatch(match.match_date, match.match_time);
  // Koga mogu da ocenim posle termina: kreator i igrači, bez mene
  const rateablePeople = [
    { id: match.user_id, name: match.creator_name },
    ...players,
  ].filter(
    (p, index, all) =>
      p.id !== user?.id && all.findIndex((x) => x.id === p.id) === index
  );

  // Pozicija na listi čekanja (1, 2, ...), 0 ako korisnik nije na listi
  const waitlistPosition = waitlist.findIndex((p) => p.id === user?.id) + 1;
  const percentage = (players.length / match.max_players) * 100;
  const formattedDate = new Date(match.match_date).toLocaleDateString("sr-RS");

  // Glavno dugme: prijava/napuštanje, ili lista čekanja kad je termin pun
  const action = joined
    ? { path: "leave", method: "DELETE" }
    : isFull && waitlistPosition
    ? { path: "waitlist", method: "DELETE" }
    : isFull
    ? { path: "waitlist", method: "POST", notify: true }
    : { path: "join", method: "POST" };

  const handleAction = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${id}/${action.path}`,
        {
          method: action.method,
          headers: authHeader(),
        }
      );

      const data = await res.json();

      if (!data.success || action.notify) {
        alert(data.message);
      }

      await loadMatch();

    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const deleteMatch = async () => {
    if (!window.confirm("Da li ste sigurni da želite da obrišete termin?")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/matches/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });

      const data = await res.json();

      alert(data.message);

      if (data.success) {
        navigate("/matches");
      }

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        <Link
          to="/matches"
          className="inline-flex items-center gap-2 text-green-700 hover:underline mb-4"
        >
          <ArrowLeft size={18} />
          Svi termini
        </Link>

        <div className="grid gap-6 lg:grid-cols-2">

          <div className="space-y-6">

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div
                className={`text-white p-6 ${
                  isFull || isPast ? "bg-gray-500" : "bg-green-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold">
                    {match.sport === "Fudbal" ? "⚽ Fudbal" : "🏀 Košarka"}
                    {match.repeat_weekly && (
                      <span className="ml-3 text-base font-semibold bg-white/20 px-3 py-1 rounded-full align-middle">
                        🔁 Svake nedelje
                      </span>
                    )}
                  </h1>

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

                <Link
                  to={`/users/${match.user_id}`}
                  className="flex items-center gap-3 mt-4 hover:opacity-80 transition"
                >
                  <Avatar
                    name={match.creator_name}
                    avatar={match.creator_avatar}
                    size="w-12 h-12"
                    text="text-xl"
                  />

                  <div>
                    <p className="text-sm text-green-100">Kreirao</p>
                    <p className="font-bold">{match.creator_name}</p>
                  </div>
                </Link>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="text-green-600" size={20} />
                  <span>{match.location}</span>
                </div>

                {hasCoords(match) && (
                  <LocationView
                    latitude={match.latitude}
                    longitude={match.longitude}
                  />
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="text-green-600" size={20} />
                  <span>
                    {formattedDate} • {match.match_time?.slice(0, 5)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="text-green-600" size={20} />
                  <span>
                    {players.length} / {match.max_players} igrača
                  </span>
                </div>

                <div className="w-full h-3 bg-gray-200 rounded-full">
                  <div
                    className="h-3 bg-green-600 rounded-full"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                <button
                  onClick={handleAction}
                  disabled={busy || isPast}
                  className={`w-full py-3 rounded-xl font-semibold text-white transition ${
                    isPast
                      ? "bg-gray-400 cursor-not-allowed"
                      : joined || waitlistPosition
                      ? "bg-red-600 hover:bg-red-700"
                      : isFull
                      ? "bg-orange-500 hover:bg-orange-600"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isPast
                    ? "Termin je odigran"
                    : joined
                    ? "Napusti termin"
                    : waitlistPosition
                    ? "Izađi sa liste čekanja"
                    : isFull
                    ? "⏳ Upiši se na listu čekanja"
                    : "Prijavi se"}
                </button>

                {match.repeat_weekly && joined && !isPast && (
                  <RegularSpot matchId={id} />
                )}

                {waitlistPosition > 0 && !isPast && (
                  <p className="text-center text-orange-700 font-medium">
                    Ti si {waitlistPosition}. na listi čekanja. Kad se oslobodi
                    mesto, automatski ćeš biti prijavljen.
                  </p>
                )}

                {isCreator && (
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      to={`/matches/${id}/edit`}
                      className="text-center py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold"
                    >
                      ✏️ Izmeni
                    </Link>

                    <button
                      onClick={deleteMatch}
                      className="py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold"
                    >
                      🗑 Obriši
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isPast && (joined || isCreator) && (
              <MatchRatings
                matchId={id}
                people={rateablePeople}
              />
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">
                👥 Učesnici
              </h2>

              {players.length > 0 ? (
                <ul className="divide-y">
                  {players.map((player) => (
                    <li key={player.id}>
                      <Link
                        to={`/users/${player.id}`}
                        className="flex items-center gap-3 py-3 hover:text-green-700"
                      >
                        <Avatar name={player.name} avatar={player.avatar} />

                        <span className="font-semibold">
                          {player.name}
                          {player.id === user?.id && (
                            <span className="text-gray-500 font-normal"> (ti)</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">Nema prijavljenih igrača.</p>
              )}

              {waitlist.length > 0 && (
                <>
                  <h3 className="text-xl font-bold mt-6 mb-2">
                    ⏳ Lista čekanja
                  </h3>

                  <ol className="divide-y">
                    {waitlist.map((player, index) => (
                      <li key={player.id}>
                        <Link
                          to={`/users/${player.id}`}
                          className="flex items-center gap-3 py-3 hover:text-green-700"
                        >
                          <span className="w-6 text-gray-400 font-semibold">
                            {index + 1}.
                          </span>

                          <Avatar name={player.name} avatar={player.avatar} />

                          <span className="font-semibold">
                            {player.name}
                            {player.id === user?.id && (
                              <span className="text-gray-500 font-normal"> (ti)</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>

          </div>

          <div>
            {user ? (
              <MatchChat
                matchId={id}
                canWrite={joined || isCreator}
              />
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                <p className="mb-4">Prijavi se da bi video čet termina.</p>

                <Link
                  to="/login"
                  className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl"
                >
                  Login
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default MatchDetails;
