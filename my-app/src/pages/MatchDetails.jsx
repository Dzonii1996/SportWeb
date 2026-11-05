import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MapPin, Calendar, Users, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import MatchChat from "../components/MatchChat";
import MatchRatings from "../components/MatchRatings";
import RegularSpot from "../components/RegularSpot";
import ShareMatch from "../components/ShareMatch";
import MatchCosts from "../components/MatchCosts";
import MatchResult from "../components/MatchResult";
import InvitePlayers, { InviteBanner } from "../components/InvitePlayers";
import { hasPrice } from "../utils/price";
import { LocationView } from "../components/LocationMap";
import { hasCoords } from "../utils/geo";
import { sportEmoji } from "../utils/sports";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { isPastMatch, matchStart, inConfirmWindow } from "../utils/matchDate";
import AttendanceBox from "../components/AttendanceBox";
import { hourLabel } from "../utils/reservations";
import { useTranslation } from "react-i18next";
import { locale, sportLabel } from "../i18n";

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

// Isti okvir kao kartica termina
const CARD = "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden";

// showConfirm: u poslednja 24 h prikazuje da li je igrač potvrdio dolazak
function PlayerRow({ player, isMe, showConfirm = false }) {
  const { t } = useTranslation();

  return (
    <li className="flex items-center justify-between gap-3">
      <Link
        to={`/users/${player.id}`}
        className="flex items-center gap-3 py-3 hover:text-green-700 min-w-0"
      >
        <Avatar name={player.name} avatar={player.avatar} />

        <span className="font-semibold truncate">
          {player.name}
          {isMe && (
            <span className="text-gray-500 font-normal"> {t("common.you")}</span>
          )}
        </span>
      </Link>

      {showConfirm && (
        player.confirmed ? (
          <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
            {t("matchDetails.coming")}
          </span>
        ) : (
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded-full whitespace-nowrap">
            {t("matchDetails.notConfirmed")}
          </span>
        )
      )}
    </li>
  );
}

// Stanje rezervacije terena za termin, vidljivo svim igračima
const RESERVATION_TEXT = {
  pending: ["bg-amber-50 border-amber-200 text-amber-900", "matchDetails.venueBookingIsAwaitingThe"],
  confirmed: ["bg-green-50 border-green-200 text-green-800", "matchDetails.theVenueIsBooked"],
  rejected: ["bg-red-50 border-red-200 text-red-800", "matchDetails.theOwnerDidNotAccept"],
  cancelled: ["bg-gray-50 border-gray-200 text-gray-700", "matchDetails.theVenueBookingWasCancelled"],
};

function ReservationBadge({ status, start, end }) {
  const { t } = useTranslation();
  const [className, text] = RESERVATION_TEXT[status];

  return (
    <div className={`border rounded-xl px-3 py-2 text-sm font-medium ${className}`}>
      {t(text)} ({hourLabel(start)}–{hourLabel(end)})
    </div>
  );
}

function MatchDetails() {
  const { t } = useTranslation();

  const { id } = useParams();

  // Ključ iz linka privatnog termina (/matches/14?key=...)
  const [searchParams] = useSearchParams();
  const accessKey = searchParams.get("key");
  const keyQuery = accessKey ? `?key=${encodeURIComponent(accessKey)}` : "";
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
        // Token: učesnici i pozvani vide privatni termin i bez ključa
        fetch(`${API_URL}/api/matches/${id}${keyQuery}`, { headers: authHeader() }),
        fetch(`${API_URL}/api/matches/${id}/players${keyQuery}`, { headers: authHeader() }),
        fetch(`${API_URL}/api/matches/${id}/waitlist${keyQuery}`, { headers: authHeader() }),
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
  }, [id, keyQuery]);

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
        <p className="text-xl mb-4">{t("matchDetails.thisGameDoesntExist")}</p>

        <Link to="/matches" className="text-green-600 hover:underline">
          {t("common.backToGames")}
        </Link>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center mt-20 text-xl">
        {t("common.loading")}
      </div>
    );
  }

  const isCreator = user?.id === match.user_id;
  const joined = players.some((p) => p.id === user?.id);
  const isFull = players.length >= Number(match.max_players);
  const isPast = isPastMatch(match.match_date, match.match_time);
  const confirmWindow = inConfirmWindow(match.match_date, match.match_time);
  const me = players.find((p) => p.id === user?.id);
  const confirmedCount = players.filter((p) => p.confirmed).length;
  // Koga mogu da ocenim posle termina: kreator i igrači, bez mene
  const rateablePeople = [
    ...players,
    { id: match.user_id, name: match.creator_name, avatar: match.creator_avatar },
  ].filter(
    (p, index, all) =>
      p.id !== user?.id && all.findIndex((x) => x.id === p.id) === index
  );

  // Pozicija na listi čekanja (1, 2, ...), 0 ako korisnik nije na listi
  const waitlistPosition = waitlist.findIndex((p) => p.id === user?.id) + 1;
  const percentage = (players.length / match.max_players) * 100;
  const freeSpots = Math.max(0, match.max_players - players.length);
  // "uto, 10. 11." (sr-Latn: bez toga Chrome piše dane ćirilicom)
  const formattedDate = matchStart(match.match_date, match.match_time).toLocaleDateString(
    locale(),
    { weekday: "long", day: "numeric", month: "numeric", year: "numeric" }
  );

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
        `${API_URL}/api/matches/${id}/${action.path}${keyQuery}`,
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

  const hasTeams = players.some((p) => p.team);

  const splitTeams = async (mode) => {
    if (hasTeams && !window.confirm(t("matchDetails.splitTheTeamsAgain"))) {
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`${API_URL}/api/matches/${id}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ mode }),
      });

      const data = await res.json();

      if (!data.success) {
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
    const question = ["pending", "confirmed"].includes(match.reservation_status)
      ? t("matchDetails.deleteTheGameTheVenue")
      : t("matchDetails.areYouSureYouWant");

    if (!window.confirm(question)) {
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
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8 px-4">
      <div className="max-w-6xl mx-auto">

        <Link
          to="/matches"
          className="inline-flex items-center gap-2 text-green-700 hover:underline mb-4"
        >
          <ArrowLeft size={18} />
          {t("common.allGames")}
        </Link>

        <div className="grid gap-6 lg:grid-cols-2">

          <div className="space-y-6 min-w-0">

            <div className={CARD}>
              {/* Zaglavlje u istom stilu kao kartica termina */}
              <div
                className={`p-6 text-white ${
                  isPast
                    ? "bg-gray-400"
                    : isFull
                    ? "bg-gradient-to-br from-gray-500 to-gray-600"
                    : "bg-gradient-to-br from-green-600 to-emerald-500"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">
                      {sportEmoji(match.sport)}
                    </span>

                    <div>
                      <h1 className="text-3xl font-bold leading-tight">
                        {sportLabel(match.sport)}
                      </h1>

                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {match.is_private && (
                          <span className="text-xs font-semibold bg-black/20 px-2 py-0.5 rounded-full">
                            {t("matchDetails.private")}
                          </span>
                        )}

                        {match.repeat_weekly && (
                          <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                            {t("matchDetails.everyWeek")}
                          </span>
                        )}

                        {isPast ? (
                          <span className="text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full">
                            {t("common.played")}
                          </span>
                        ) : isFull ? (
                          <span className="text-xs font-bold bg-red-500 px-2 py-0.5 rounded-full">
                            {t("common.full")}
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-white text-green-700 px-2 py-0.5 rounded-full">
                            {freeSpots} {freeSpots === 1 ? t("matchDetails.freeSpot") : t("matchDetails.freeSpots")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Kreator: izmena i brisanje kao male ikonice */}
                  {isCreator && (
                    <div className="flex gap-1.5">
                      <Link
                        to={`/matches/${id}/edit`}
                        title={t("common.editGame")}
                        aria-label={t("common.editGame")}
                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition"
                      >
                        <Pencil size={18} />
                      </Link>

                      <button
                        onClick={deleteMatch}
                        title={t("common.deleteGame")}
                        aria-label={t("common.deleteGame")}
                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-red-500 flex items-center justify-center transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <Link
                  to={`/users/${match.user_id}`}
                  className="inline-flex items-center gap-2 mt-5 hover:opacity-80 transition"
                >
                  <Avatar
                    name={match.creator_name}
                    avatar={match.creator_avatar}
                    size="w-9 h-9"
                    text="text-sm"
                  />

                  {isCreator ? (
                    <span className="font-semibold">{t("common.yourGame")}</span>
                  ) : (
                    <>
                      <span className="text-white/80">{t("common.organizer")}</span>
                      <span className="font-semibold">{match.creator_name}</span>
                    </>
                  )}
                </Link>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <MapPin className="text-green-600 shrink-0" size={18} />
                  <span>{match.location}</span>

                  {match.venue_id && (
                    <Link
                      to={`/tereni/${match.venue_id}`}
                      className="ml-auto text-sm text-green-700 hover:underline font-medium whitespace-nowrap"
                    >
                      {t("matchDetails.aboutTheVenue")}
                    </Link>
                  )}
                </div>

                {match.reservation_status && (
                  <ReservationBadge
                    status={match.reservation_status}
                    start={match.reservation_start_hour}
                    end={match.reservation_end_hour}
                  />
                )}

                {hasCoords(match) && (
                  <LocationView
                    latitude={match.latitude}
                    longitude={match.longitude}
                  />
                )}

                <div className="flex items-center gap-3 text-gray-700">
                  <Calendar className="text-green-600 shrink-0" size={18} />
                  <span>
                    <span className="capitalize">{formattedDate}</span>
                    {" • "}
                    <span className="font-semibold">{match.match_time?.slice(0, 5)}</span>
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Users size={15} />
                      {t("matchDetails.players", { length: players.length, max_players: match.max_players })}
                    </span>

                    {joined && !isPast && (
                      <span className="text-green-700 font-semibold">{t("common.youreIn")}</span>
                    )}
                  </div>

                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        isFull ? "bg-orange-400" : percentage >= 75 ? "bg-amber-400" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Pozvan, a još nije prijavljen ni na listi čekanja */}
                {user && !isCreator && !joined && !waitlistPosition && !isPast && (
                  <InviteBanner matchId={id} />
                )}

                {/* Ista dugmad kao na kartici: napuštanje je obrubljeno, a na hover zeleno */}
                <button
                  onClick={handleAction}
                  disabled={busy || isPast}
                  className={`w-full py-3 rounded-xl font-semibold transition ${
                    isPast
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : joined || waitlistPosition
                      ? "border-2 border-red-200 text-red-600 hover:bg-green-600 hover:border-green-600 hover:text-white"
                      : isFull
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                      : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  }`}
                >
                  {isPast
                    ? t("common.gameHasBeenPlayed")
                    : joined
                    ? t("common.leaveGame")
                    : waitlistPosition
                    ? t("matchDetails.leaveTheWaitlist")
                    : isFull
                    ? t("matchDetails.joinTheWaitlist")
                    : t("common.join")}
                </button>

                {joined && confirmWindow && (
                  <AttendanceBox
                    matchId={id}
                    confirmed={Boolean(me?.confirmed)}
                    onChange={loadMatch}
                  />
                )}

                {match.repeat_weekly && joined && !isPast && (
                  <RegularSpot matchId={id} />
                )}

                {waitlistPosition > 0 && !isPast && (
                  <p className="text-center text-orange-700 font-medium">
                    {t("matchDetails.youAreNumberOnThe", { waitlistPosition })}
                  </p>
                )}

                {hasPrice(match) && (
                  <MatchCosts
                    match={match}
                    players={players}
                    isCreator={isCreator}
                    userId={user?.id}
                    onChange={loadMatch}
                  />
                )}

                {isCreator && match.is_private && !isPast && (
                  <p className="text-sm text-gray-600 bg-gray-50 border rounded-xl p-3">
                    {t("matchDetails.thisPrivateGameIsntIn")}
                  </p>
                )}

                {isCreator && !isPast && <InvitePlayers matchId={id} />}

                {!isPast && (
                  <ShareMatch
                    match={match}
                    freeSpots={Math.max(0, match.max_players - players.length)}
                  />
                )}
              </div>
            </div>

            {isPast && (
              <MatchResult
                match={match}
                players={players}
                isCreator={isCreator}
                userId={user?.id}
                onChange={loadMatch}
              />
            )}

            {isPast && (joined || isCreator) && (
              <MatchRatings
                matchId={id}
                people={rateablePeople}
              />
            )}

            <div className={`${CARD} p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold">
                  {t("matchDetails.participants")}
                </h2>

                {confirmWindow && players.length > 0 && (
                  <span className="text-sm font-semibold text-gray-600">
                    {t("matchDetails.confirmed", { confirmedCount, length: players.length })}
                  </span>
                )}

                {/* Kreator deli igrače na timove */}
                {/* Timovi mogu da se podele i posle termina, dok rezultat nije upisan */}
                {isCreator && players.length >= 2 && match.score_a === null && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => splitTeams("random")}
                      disabled={busy}
                      className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 font-medium"
                      title={t("matchDetails.randomSplit")}
                    >
                      {t("matchDetails.random")}
                    </button>

                    <button
                      onClick={() => splitTeams("balanced")}
                      disabled={busy}
                      className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 font-medium"
                      title={t("matchDetails.theBestRatedPlayersAre")}
                    >
                      {t("matchDetails.balanced")}
                    </button>
                  </div>
                )}
              </div>

              {players.length === 0 ? (
                <p className="text-gray-500">{t("common.noPlayersHaveJoined")}</p>
              ) : hasTeams ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { team: "A", label: t("common.teamA"), color: "border-green-500 bg-green-50" },
                    { team: "B", label: t("common.teamB"), color: "border-blue-500 bg-blue-50" },
                  ].map(({ team, label, color }) => {
                    const members = players.filter((p) => p.team === team);

                    return (
                      <div key={team} className={`border-t-4 rounded-xl p-3 ${color}`}>
                        <h3 className="font-bold">
                          {label} ({members.length})
                        </h3>

                        <ul className="divide-y divide-white">
                          {members.map((p) => (
                            <PlayerRow key={p.id} player={p} isMe={p.id === user?.id} showConfirm={confirmWindow} />
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {players.some((p) => !p.team) && (
                    <div className="sm:col-span-2">
                      <h3 className="font-bold text-gray-600">
                        {t("matchDetails.joinedAfterTheSplit")}
                      </h3>

                      <ul className="divide-y">
                        {players.filter((p) => !p.team).map((p) => (
                          <PlayerRow key={p.id} player={p} isMe={p.id === user?.id} showConfirm={confirmWindow} />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="divide-y">
                  {players.map((p) => (
                    <PlayerRow key={p.id} player={p} isMe={p.id === user?.id} showConfirm={confirmWindow} />
                  ))}
                </ul>
              )}

              {waitlist.length > 0 && (
                <>
                  <h3 className="text-xl font-bold mt-6 mb-2">
                    {t("matchDetails.waitlist")}
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
                              <span className="text-gray-500 font-normal"> {t("common.you")}</span>
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
                linkKey={accessKey}
                canWrite={joined || isCreator}
              />
            ) : (
              <div className={`${CARD} p-6 text-center`}>
                <p className="mb-4">{t("matchDetails.signInToSeeThe")}</p>

                <Link
                  to="/login"
                  className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl"
                >
                  {t("matchDetails.signIn")}
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
